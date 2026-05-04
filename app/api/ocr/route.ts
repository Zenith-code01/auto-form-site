import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type LicenceExtraction = {
  customer_name: string
  document_type: string
  document_number: string
  date_of_birth: string
  address: string
  expiry_date: string
  card_number: string
  licence_class: string
  conditions: string
  issuing_state: string
}

type ConditionsReview = {
  conditions: string
  confidence: 'high' | 'low'
}

function cleanValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  const cleaned = value.trim()

  if (
    !cleaned ||
    /^null$/i.test(cleaned) ||
    /^undefined$/i.test(cleaned) ||
    /^n\/a$/i.test(cleaned) ||
    /^na$/i.test(cleaned) ||
    /^not visible$/i.test(cleaned) ||
    /^unreadable$/i.test(cleaned)
  ) {
    return ''
  }

  return cleaned
}

function normalizeAustralianState(value: unknown): string {
  const cleaned = cleanValue(value).toUpperCase().replace(/\./g, '')
  if (!cleaned) return ''

  const stateMap: Record<string, string> = {
    NSW: 'NSW',
    'NEW SOUTH WALES': 'NSW',
    VIC: 'VIC',
    VICTORIA: 'VIC',
    QLD: 'QLD',
    QUEENSLAND: 'QLD',
    WA: 'WA',
    'WESTERN AUSTRALIA': 'WA',
    SA: 'SA',
    'SOUTH AUSTRALIA': 'SA',
    TAS: 'TAS',
    TASMANIA: 'TAS',
    ACT: 'ACT',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
    NT: 'NT',
    'NORTHERN TERRITORY': 'NT',
  }

  return stateMap[cleaned] || ''
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function sameSingleCode(left: string, right: string): boolean {
  const a = cleanValue(left).toUpperCase()
  const b = cleanValue(right).toUpperCase()
  return Boolean(a && b && a === b)
}

async function reviewConditionsField({
  dataUrl,
  licenceClass,
  initialConditions,
}: {
  dataUrl: string
  licenceClass: string
  initialConditions: string
}): Promise<string> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'driver_licence_conditions_review',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            conditions: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'low'] },
          },
          required: ['conditions', 'confidence'],
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: `
You are reviewing only the Conditions field on an Australian driver licence image.

Return only valid JSON matching the schema.

Rules:
1. Read only the field labelled "Conditions", "Cond", or an equivalent conditions label.
2. Do not read or copy the Licence Class field.
3. The known Licence Class from the first pass is "${licenceClass}". If you see "${licenceClass}" in the class area, ignore it for this task.
4. On NSW licences, the Licence Class may be "C" while the Conditions value may be a different code such as "S". Keep them separate.
5. If the Conditions field is visible, return the exact code shown.
6. If the Conditions field is blank, blocked, or unreadable, return an empty string and confidence "low".
7. If you are confident you can read the Conditions value, return confidence "high".
8. Do not guess.
`.trim(),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
The first pass read Licence Class as "${licenceClass}" and Conditions as "${initialConditions}".

That is suspicious because they are the same. Please re-check the image and return only the actual Conditions value.
            `.trim(),
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
              detail: 'high',
            },
          },
        ],
      },
    ],
  })

  const content = completion.choices?.[0]?.message?.content
  if (!content) return ''

  try {
    const parsed = JSON.parse(content) as ConditionsReview
    if (parsed.confidence !== 'high') return ''
    return cleanValue(parsed.conditions)
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '没有收到文件' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: '缺少 OPENAI_API_KEY，请先配置 .env.local' },
        { status: 500 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = file.type || 'image/jpeg'
    const base64Image = buffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'driver_licence_extraction',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              customer_name: { type: 'string' },
              document_type: { type: 'string' },
              document_number: { type: 'string' },
              date_of_birth: { type: 'string' },
              address: { type: 'string' },
              expiry_date: { type: 'string' },
              card_number: { type: 'string' },
              licence_class: { type: 'string' },
              conditions: { type: 'string' },
              issuing_state: { type: 'string' },
            },
            required: [
              'customer_name',
              'document_type',
              'document_number',
              'date_of_birth',
              'address',
              'expiry_date',
              'card_number',
              'licence_class',
              'conditions',
              'issuing_state',
            ],
          },
        },
      },
      messages: [
        {
          role: 'system',
          content: `
You extract fields from an Australian driver licence image.

Return only valid JSON matching the schema.

Rules:
1. Read each field independently.
2. "licence_class" and "conditions" are different fields and must not be copied from each other.
3. The conditions field is usually a small field near or below the licence class field.
4. If the conditions value is visible, return it exactly.
5. If unreadable, return an empty string.
6. "issuing_state" is the Australian state or territory that issued the licence, such as NSW, VIC, QLD, WA, SA, TAS, ACT, or NT.
7. Do not infer issuing_state from the address. Only return it if it is clearly shown by the licence design, logo, heading, or visible issuing authority.
8. "document_type" should be "Australian Driver Licence" unless the image clearly shows another Australian licence document type.
9. Do not guess.
`.trim(),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Extract these fields from the Australian driver licence image:

- customer_name
- document_type
- document_number
- date_of_birth
- address
- expiry_date
- card_number
- licence_class
- conditions
- issuing_state

Important:
- Read the conditions field carefully.
- Do not copy the Licence Class value into conditions.
- Example: if Licence Class is C and the Conditions field shows S, return conditions as S.
- If the conditions area contains a short code like S, A, B, C, etc., return that exact code.
- If it contains multiple codes, return them as shown.
- If it is blank or unreadable, return an empty string.
- For issuing_state, return only NSW, VIC, QLD, WA, SA, TAS, ACT, or NT.
- Do not derive issuing_state from the address.
              `.trim(),
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
    })

    const content = completion.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'OpenAI 未返回识别结果' },
        { status: 500 }
      )
    }

    let parsed: LicenceExtraction

    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json(
        {
          error: 'OpenAI 返回结果不是有效 JSON',
          raw: content,
        },
        { status: 500 }
      )
    }

    const licenceClass = cleanValue(parsed.licence_class)
    let conditions = cleanValue(parsed.conditions)

    if (!conditions || sameSingleCode(conditions, licenceClass)) {
      const reviewedConditions = await reviewConditionsField({
        dataUrl,
        licenceClass,
        initialConditions: conditions,
      })
      if (reviewedConditions) {
        conditions = reviewedConditions
      }
    }

    const result: LicenceExtraction = {
      customer_name: cleanValue(parsed.customer_name),
      document_type: cleanValue(parsed.document_type),
      document_number: cleanValue(parsed.document_number),
      date_of_birth: cleanValue(parsed.date_of_birth),
      address: cleanValue(parsed.address),
      expiry_date: cleanValue(parsed.expiry_date),
      card_number: cleanValue(parsed.card_number),
      licence_class: licenceClass,
      conditions,
      issuing_state: normalizeAustralianState(parsed.issuing_state),
    }

    console.log('OCR result:', result)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('OCR 接口失败:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'OCR 接口失败') },
      { status: 500 }
    )
  }
}
