'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import { fillPdf } from '@/src/lib/pdf-fill'
import { getPdfFields, type PdfFieldInfo } from '@/src/lib/pdf-fields'
import { convertPdfToForm } from '@/src/lib/pdf-to-form'
import BackButton from '@/src/components/BackButton'
import LanguageToggle from '@/src/components/LanguageToggle'
import { useLanguage } from '@/src/lib/use-language'
import { getCurrentAdminUser } from '@/src/lib/admin'

type ProfileData = {
  name: string
  company: string
  address: string
  phone: string
}

type CustomerProfile = {
  id: string
  customer_name: string
  document_type: string
  document_number: string
  date_of_birth: string
  address: string
  expiry_date: string
  photo_url?: string
  created_at?: string
  card_number?: string
  licence_class?: string
  conditions?: string
  issuing_state?: string
}

type GeneratedPdfRecord = {
  id: string
  user_id: string
  source_pdf_path: string
  generated_pdf_path: string
  file_name: string
  form_data: Record<string, string>
  selected_module_ids: string[]
  revision: number
}

const uiText = {
  en: {
    back: 'Back',
    languageButton: '中文',
    readingFields: 'Reading PDF fields...',
    noFields:
      'No built-in PDF fields were found. This system currently only supports the IM Capital Private Credit Fund Application Form.',
    noModules: 'Fields were found, but no form modules were generated.',
    moduleSelection: 'Select modules to fill',
    selectAll: 'Select All',
    clear: 'Clear',
    items: 'items',
    unclassified: 'Unclassified',
    section: 'Section',
    selectAtLeastOne:
      'Please select at least one module. Unselected modules will remain blank in the generated PDF.',
    chooseCustomer: 'Choose Customer Info',
    loading: 'Loading...',
    inputPrefix: 'Enter',
    multiSelectHint: 'Hold Ctrl on Windows or Command on Mac to select multiple options.',
    filledContent: 'Filled Content',
    noFilledContent: 'No fields have been filled yet.',
    generatePdf: 'Generate PDF',
    generateButton: 'Generate Filled PDF',
    noFileSelected: 'No file selected',
    generating: 'Generating PDF...',
    generated: 'PDF generated successfully',
    generateFailed: 'Generation failed: ',
    unknownError: 'Unknown error',
    readFieldsFailed: 'Failed to read PDF fields: ',
    loginRequired: 'Please log in first',
    readCustomersFailed: 'Failed to read customer info',
    filledModule: 'Customer info filled into module: ',
    filledCustomer: 'Customer info filled automatically: ',
    unnamedCustomer: 'Unnamed Customer',
  },
  zh: {
    back: '返回上一页',
    languageButton: 'English',
    readingFields: '正在读取 PDF 字段...',
    noFields:
      '没有识别到 PDF 内置字段。当前系统仅适用于 IM Capital Private Credit Fund Application Form。',
    noModules: '已识别字段，但暂时没有成功生成表单模块。',
    moduleSelection: '选择需要填写的模块',
    selectAll: '全选',
    clear: '清空',
    items: '项',
    unclassified: '未分类',
    section: '部分',
    selectAtLeastOne: '请选择至少一个模块。未选择的模块在生成 PDF 时会保持空白。',
    chooseCustomer: '选择客户信息',
    loading: '读取中...',
    inputPrefix: '请输入',
    multiSelectHint: '按住 Ctrl（Windows）或 Command（Mac）可多选',
    filledContent: '已填写内容',
    noFilledContent: '还没有填写任何字段。',
    generatePdf: '生成 PDF',
    generateButton: '生成已填写 PDF',
    noFileSelected: '没有选择文件',
    generating: '正在生成 PDF...',
    generated: 'PDF 生成成功',
    generateFailed: '生成失败：',
    unknownError: '未知错误',
    readFieldsFailed: '读取 PDF 字段失败：',
    loginRequired: '请先登录',
    readCustomersFailed: '读取客户信息失败',
    filledModule: '已将客户信息填入模块：',
    filledCustomer: '已自动填入客户信息：',
    unnamedCustomer: '未命名客户',
  },
} as const

// Form labels must mirror the PDF, so translations are intentionally disabled.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fieldTranslations: Record<string, string> = {
  'Your Email Address': '你的邮箱地址',
  'Full Name': '全名',
  'Contact Phone Number': '联系电话',
  Title: '称谓',
  'First Name': '名',
  'Middle Name': '中间名',
  'Last Name': '姓',
  DOB: '出生日期',
  'Date of Birth': '出生日期',
  'Place of Birth': '出生地',
  'Country of Birth': '出生国家',
  Number: '号码',
  'Card / Document No.': '卡号 / 文件编号',
  'Place of Issue': '签发地',
  'Expiry Date': '到期日',
  'Expiry Date (if applicable)': '到期日（如适用）',
  'DL Number': '驾照号码',
  'DL Card No': '驾照卡号',
  'DL Place of Issue': '驾照签发地',
  'DL - Expiry Date': '驾照到期日',
  Passport: '护照',
  'Passport Number': '护照号码',
  'Passport Card No': '护照文件编号',
  'Passport Place of Issue': '护照签发地',
  'Passport - Expiry Date': '护照到期日',
  'Unit No.': '单元号',
  'Street No.': '街道号',
  'Street Name': '街道名称',
  Suburb: '城区',
  State: '州',
  Postcode: '邮编',
  Country: '国家',
  Phone: '电话',
  'Phone (Work)': '工作电话',
  Mobile: '手机',
  Email: '邮箱',
  'Tax File Number or Reason for Exemption': '税号或豁免原因',
  'Country of residence for tax purposes (if not Australia)': '税务居民国家（如非澳大利亚）',
  'Business name (for Sole Trader)': '商业名称（个体经营者）',
  'Application Type': '申请类型',
  'Source of Funds': '资金来源',
  'Method of Payment': '付款方式',
  'Bank Name': '银行名称',
  'Account Name': '账户名称',
  'BSB Number': 'BSB 号码',
  'Account Number': '账户号码',
  'Name 1': '姓名 1',
  'Name 2': '姓名 2',
  'Date 1': '日期 1',
  'Date 2': '日期 2',
  Name: '姓名',
  Name_2: '姓名 2',
  Date: '日期',
  Date14: '日期 1',
  Date15: '日期 2',
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function FillPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filePath = searchParams.get('path') || ''
  const generatedId = searchParams.get('generatedId') || ''
  const { language, toggleLanguage } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    company: '',
    address: '',
    phone: '',
  })

  const [pdfFields, setPdfFields] = useState<PdfFieldInfo[]>([])
  const [loadingFields, setLoadingFields] = useState(true)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})

  const [storedCustomers, setStoredCustomers] = useState<CustomerProfile[]>([])
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerTargetModuleId, setCustomerTargetModuleId] = useState<string | null>(null)
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [generatedRecord, setGeneratedRecord] = useState<GeneratedPdfRecord | null>(null)
  const [pendingModuleIds, setPendingModuleIds] = useState<string[] | null>(null)
  const text = uiText[language]

  const formModules = useMemo(() => convertPdfToForm(pdfFields), [pdfFields])

  const visibleFormModules = useMemo(() => {
    const selected = new Set(selectedModuleIds)
    return formModules.filter((module) => selected.has(module.id))
  }, [formModules, selectedModuleIds])

  const activeFieldNames = useMemo(() => {
    return visibleFormModules.flatMap((module) =>
      module.fields.map((field) => field.key)
    )
  }, [visibleFormModules])

  const groupedFormModules = useMemo(() => {
    const getModulePosition = (module: (typeof formModules)[number]) => {
      return module.fields
        .map((field) => ({
          pageIndex: field.pageIndex ?? Number.MAX_SAFE_INTEGER,
          x: field.x ?? Number.MAX_SAFE_INTEGER,
          top: (field.y ?? 0) + (field.height ?? 0),
          pdfOrder: field.pdfOrder ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => {
          if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
          if (Math.abs(a.top - b.top) > 2) return b.top - a.top
          if (Math.abs(a.x - b.x) > 2) return a.x - b.x
          return a.pdfOrder - b.pdfOrder
        })[0]
    }

    const groups = formModules.reduce<Array<{ section: string; modules: typeof formModules }>>(
      (groups, module) => {
        const match = module.title.match(/^([A-Z])\s+-\s+(.+)$/)
        const section = match ? match[1] : 'Other'
        const existing = groups.find((group) => group.section === section)

        if (existing) {
          existing.modules.push(module)
        } else {
          groups.push({ section, modules: [module] })
        }

        return groups
      },
      []
    )

    return groups.map((group) => ({
      ...group,
      modules: [...group.modules].sort((a, b) => {
        const positionA = getModulePosition(a)
        const positionB = getModulePosition(b)

        if (!positionA || !positionB) return 0
        if (positionA.pageIndex !== positionB.pageIndex) {
          return positionA.pageIndex - positionB.pageIndex
        }
        if (Math.abs(positionA.top - positionB.top) > 2) {
          return positionB.top - positionA.top
        }
        if (Math.abs(positionA.x - positionB.x) > 2) {
          return positionA.x - positionB.x
        }
        return positionA.pdfOrder - positionB.pdfOrder
      }),
    }))
  }, [formModules])

  const totalRenderedFields = useMemo(() => {
    return visibleFormModules.reduce((sum, module) => sum + module.fields.length, 0)
  }, [visibleFormModules])

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const buildGeneratedFileName = () => {
    const sourceName = filePath.split('/').pop() || 'filled-form.pdf'
    const baseName = sourceName.replace(/\.pdf$/i, '')
    return `${baseName}-filled.pdf`
  }

  const saveGeneratedPdfRecord = async (pdfBytes: Uint8Array) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error(text.loginRequired)
    }

    const fileName = generatedRecord?.file_name || buildGeneratedFileName()
    const generatedPath =
      generatedRecord?.generated_pdf_path ||
      `${user.id}/${Date.now()}_${fileName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '')
        .replace(/_+/g, '_')}`

    const { error: uploadError } = await supabase.storage
      .from('generated-pdfs')
      .upload(generatedPath, new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), {
        contentType: 'application/pdf',
        upsert: Boolean(generatedRecord),
      })

    if (uploadError) throw uploadError

    if (generatedRecord) {
      const { error } = await supabase
        .from('generated_pdfs')
        .update({
          generated_pdf_path: generatedPath,
          file_name: fileName,
          form_data: formData,
          selected_module_ids: selectedModuleIds,
          revision: generatedRecord.revision + 1,
        })
        .eq('id', generatedRecord.id)

      if (error) throw error
      setGeneratedRecord({
        ...generatedRecord,
        generated_pdf_path: generatedPath,
        file_name: fileName,
        form_data: formData,
        selected_module_ids: selectedModuleIds,
        revision: generatedRecord.revision + 1,
      })
      return
    }

    const { data, error } = await supabase
      .from('generated_pdfs')
      .insert({
        user_id: user.id,
        source_pdf_path: filePath,
        generated_pdf_path: generatedPath,
        file_name: fileName,
        form_data: formData,
        selected_module_ids: selectedModuleIds,
      })
      .select('id, user_id, source_pdf_path, generated_pdf_path, file_name, form_data, selected_module_ids, revision')
      .single()

    if (error) throw error
    setGeneratedRecord(data)
  }

  const toggleModule = (moduleId: string) => {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    )
  }

  const isCustomerMappableModule = (moduleId: string) => {
    return /^(applicant|director|beneficial-owner|partner|trust-beneficiary|trust-owner-controller)-\d+$/.test(
      moduleId
    )
  }

  const escapeRegExp = (value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const splitModuleTitle = (moduleTitle: string) => {
    const titleWithoutSection = moduleTitle.replace(/^[A-Z]\s+-\s+/, '')
    const englishStart = titleWithoutSection.search(
      /\b(?:Applicant|Director|Beneficial|Partner|Trust|Company|Corporate|Partnership|Politically|Individual|Entity|Distribution|Reporting|Adviser|Accountant|Signatures|Other|Basic|Application)\b/
    )

    if (englishStart > 0) {
      return {
        titleWithoutSection,
        chineseTitle: titleWithoutSection
          .slice(0, englishStart)
          .replace(/\/\s*$/, '')
          .trim(),
        englishTitle: titleWithoutSection.slice(englishStart).trim(),
      }
    }

    const slashIndex = titleWithoutSection.search(/\s\/\s/)

    if (slashIndex >= 0) {
      return {
        titleWithoutSection,
        chineseTitle: titleWithoutSection.slice(0, slashIndex).trim(),
        englishTitle: titleWithoutSection
          .slice(slashIndex + 1)
          .replace(/^\/\s*/, '')
          .trim(),
      }
    }

    return {
      titleWithoutSection,
      chineseTitle: titleWithoutSection,
      englishTitle: titleWithoutSection,
    }
  }

  const getModuleFieldLabel = useCallback((
    moduleTitle: string,
    label: string,
    moduleId?: string
  ) => {
    const { englishTitle: moduleEnglish } = splitModuleTitle(moduleTitle)
    const idPrefix = moduleId?.match(
      /^(applicant|director|beneficial-owner|partner|trust-beneficiary|trust-owner-controller)-(\d+)$/
    )
    const idPrefixLabel = idPrefix
      ? {
          applicant: `Applicant ${idPrefix[2]}`,
          director: `Director ${idPrefix[2]}`,
          'beneficial-owner': `Beneficial Owner ${idPrefix[2]}`,
          partner: `Partner ${idPrefix[2]}`,
          'trust-beneficiary': `Beneficiary ${idPrefix[2]}`,
          'trust-owner-controller': `Beneficial Owner ${idPrefix[2]}`,
        }[idPrefix[1]]
      : ''
    const idAliasPrefixes =
      idPrefix?.[1] === 'trust-owner-controller'
        ? [
            `Beneficial Owner or Controller ${idPrefix[2]}`,
            `Beneficial Owner / Controller ${idPrefix[2]}`,
            `BO/Controller of Trust ${idPrefix[2]}`,
            `Beneficial Owner ${idPrefix[2]}`,
          ]
        : idPrefix?.[1] === 'trust-beneficiary'
          ? [
              `D. Trust/Superfund Beneficiarie ${idPrefix[2]}`,
              `D. Trust/Superfund Beneficiary ${idPrefix[2]}`,
              `Trust/Superfund Beneficiarie ${idPrefix[2]}`,
              `Trust/Superfund Beneficiary ${idPrefix[2]}`,
              `Trust Beneficiarie ${idPrefix[2]}`,
              `Trust Beneficiary ${idPrefix[2]}`,
              `Beneficiarie ${idPrefix[2]}`,
              `Beneficiary ${idPrefix[2]}`,
            ]
        : []
    const prefixes = Array.from(
      new Set(
        [idPrefixLabel, moduleEnglish, ...idAliasPrefixes].filter(
          (value): value is string => Boolean(value)
        )
      )
    ).sort((a, b) => b.length - a.length)

    if (prefixes.length === 0) return label

    return prefixes.reduce((currentLabel, prefix) => {
      return currentLabel
        .replace(new RegExp(`^${escapeRegExp(prefix)}\\s*-\\s*`, 'i'), '')
        .replace(new RegExp(`^${escapeRegExp(prefix)}\\s+`, 'i'), '')
        .replace(/^D[.\s-]+Trust\/Superfund Beneficiar(?:y|ie)\s+\d+\s*-\s*/i, '')
        .replace(/^-\s*/, '')
        .trim()
    }, label)
  }, [])

  const getLocalizedModuleTitle = useCallback(
    (moduleTitle: string) => {
      const { titleWithoutSection, englishTitle } = splitModuleTitle(moduleTitle)
      const trustControllerMatch = titleWithoutSection.match(/^.*Trust Controller ([1-3])$/)

      if (trustControllerMatch) {
        return `Beneficial Owner ${trustControllerMatch[1]}`
      }

      return englishTitle.replace(/^\/\s*/, '').trim()
    },
    []
  )

  const getDisplayFieldLabel = useCallback(
    (moduleTitle: string, label: string, moduleId?: string) => {
      return getModuleFieldLabel(moduleTitle, label, moduleId)
    },
    [getModuleFieldLabel]
  )

  const filledFormPreview = useMemo(() => {
    return visibleFormModules
      .map((module) => ({
        id: module.id,
        title: getLocalizedModuleTitle(module.title),
        fields: module.fields
          .map((field) => ({
            label: getDisplayFieldLabel(module.title, field.label, module.id),
            value: formData[field.key] || '',
          }))
          .filter((field) => field.value.trim() !== ''),
      }))
      .filter((module) => module.fields.length > 0)
  }, [formData, getDisplayFieldLabel, getLocalizedModuleTitle, visibleFormModules])

  const normalizeFieldName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const extractStateFromAddress = (address: string) => {
    const text = (address || '').toUpperCase()
    if (/\bNSW\b/.test(text)) return 'NSW'
    if (/\bVIC\b/.test(text)) return 'VIC'
    if (/\bQLD\b/.test(text)) return 'QLD'
    if (/\bWA\b/.test(text)) return 'WA'
    if (/\bSA\b/.test(text)) return 'SA'
    if (/\bTAS\b/.test(text)) return 'TAS'
    if (/\bACT\b/.test(text)) return 'ACT'
    if (/\bNT\b/.test(text)) return 'NT'
    return ''
  }

  const toDateInputValue = (value: string) => {
    const input = (value || '').trim()
    if (!input) return ''

    // 已经是 yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input
    }

    // dd/mm/yyyy -> yyyy-mm-dd
    const slashMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }

    // 01 JAN 2030 -> 2030-01-01
    const months: Record<string, string> = {
      JAN: '01',
      FEB: '02',
      MAR: '03',
      APR: '04',
      MAY: '05',
      JUN: '06',
      JUL: '07',
      AUG: '08',
      SEP: '09',
      OCT: '10',
      NOV: '11',
      DEC: '12',
    }

    const parts = input.toUpperCase().split(/\s+/)
    if (parts.length === 3) {
      const dd = parts[0].padStart(2, '0')
      const mm = months[parts[1]]
      const yyyy = parts[2]

      if (mm && /^\d{4}$/.test(yyyy)) {
        return `${yyyy}-${mm}-${dd}`
      }
    }

    return ''
  }

  const fromDateInputValue = (value: string) => {
    const input = (value || '').trim()
    if (!input) return ''

    // yyyy-mm-dd -> dd/mm/yyyy
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return input

    const [, yyyy, mm, dd] = match
    return `${dd}/${mm}/${yyyy}`
  }

  const buildCustomerFieldMap = (customer: CustomerProfile) => {
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = String(today.getFullYear())
    const todayStr = `${dd}/${mm}/${yyyy}`

    return {
      'full name': customer.customer_name || '',
      name: customer.customer_name || '',

      'date of birth': customer.date_of_birth || '',
      dob: customer.date_of_birth || '',

      'licence number': customer.document_number || '',
      'license number': customer.document_number || '',
      'driver licence number': customer.document_number || '',
      'driver license number': customer.document_number || '',
      'licence no': customer.document_number || '',
      'license no': customer.document_number || '',
      'document number': customer.document_number || '',

      'card number': customer.card_number || '',
      'licence class': customer.licence_class || '',
      'license class': customer.licence_class || '',
      conditions: customer.conditions || '',
      'licence conditions': customer.conditions || '',
      'license conditions': customer.conditions || '',

      address: customer.address || '',
      state: extractStateFromAddress(customer.address || ''),
      'address state': extractStateFromAddress(customer.address || ''),
      'residential state': extractStateFromAddress(customer.address || ''),
      'postal state': extractStateFromAddress(customer.address || ''),
      'issuing state': customer.issuing_state || '',
      'state of issue': customer.issuing_state || '',
      'licence state': customer.issuing_state || '',
      'license state': customer.issuing_state || '',
      'driver licence state': customer.issuing_state || '',
      'driver license state': customer.issuing_state || '',

      'expiry date': customer.expiry_date || '',
      expiry: customer.expiry_date || '',

      'signature date': todayStr,
      date: todayStr,
    }
  }

  const splitCustomerName = (name: string) => {
    const parts = normalizeFieldName(name).split(' ').filter(Boolean)

    if (parts.length === 0) {
      return { firstName: '', middleName: '', lastName: '' }
    }

    if (parts.length === 1) {
      return { firstName: parts[0], middleName: '', lastName: '' }
    }

    if (parts.length === 2) {
      return { firstName: parts[0], middleName: '', lastName: parts[1] }
    }

    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
    }
  }

  const getCustomerDocumentKind = (customer: CustomerProfile) => {
    const documentType = normalizeFieldName(customer.document_type || '')

    if (/\bpassport\b/.test(documentType)) return 'passport'
    if (/\b(driver|licence|license|dl)\b/.test(documentType)) return 'licence'
    return ''
  }

  const getCustomerValueForField = (
    field: { name: string; label?: string },
    customer: CustomerProfile,
    customerMap: ReturnType<typeof buildCustomerFieldMap>
  ) => {
    const normalizedName = normalizeFieldName(field.name)
    const normalizedLabel = normalizeFieldName(field.label || '')
    const text = `${normalizedName} ${normalizedLabel}`.trim()
    const { firstName, middleName, lastName } = splitCustomerName(
      customer.customer_name || ''
    )
    const documentKind = getCustomerDocumentKind(customer)
    const isPassportField = /\bpassport\b/.test(text)
    const isLicenceField = /\b(driver'?s?\s*)?(licence|license)\b|\bdl\b/.test(text)
    const isAddressField =
      /\b(address|residential address|street address|postal address|unit no|street no|street name|suburb|postcode|country)\b/.test(
        text
      )
    const isNonPersonNameField =
      /company|business|bank|account|signature|street|suburb|address|country|state|postcode|place of birth|place of issue/.test(
        text
      )

    if (documentKind === 'licence' && isPassportField) return ''
    if (documentKind === 'passport' && isLicenceField) return ''

    if (/\bstreet name\b/.test(text)) return customerMap.address
    if (/\b(address|residential address|street address|postal address)\b/.test(text)) {
      return customerMap.address
    }

    if (!isAddressField && /\bfirst name\b/.test(text)) return firstName
    if (!isAddressField && /\bmiddle name\b/.test(text)) return middleName
    if (!isAddressField && (/\blast name\b/.test(text) || /\bsurname\b/.test(text))) {
      return lastName
    }

    const directMatch =
      customerMap[normalizedName as keyof typeof customerMap] ||
      customerMap[normalizedLabel as keyof typeof customerMap]

    if (directMatch) return directMatch

    if (
      /\b(full name|customer name|applicant name|name of applicant|client name)\b/.test(
        text
      ) ||
      (/\bname\b/.test(text) && !isNonPersonNameField)
    ) {
      return customerMap['full name']
    }

    if (/\b(date of birth|birth date|dob)\b/.test(text)) {
      return customerMap['date of birth']
    }

    if (
      /\b(licence|license|driver licence|driver license|document)\b/.test(text) &&
      /\b(number|no|num|id)\b/.test(text) &&
      !/\bcard\b/.test(text)
    ) {
      return customerMap['document number']
    }

    if (/\bcard\b/.test(text) && /\b(number|no|num)\b/.test(text)) {
      return customerMap['card number']
    }

    if (/\b(class)\b/.test(text) && /\b(licence|license|driver)\b/.test(text)) {
      return customerMap['licence class']
    }

    if (/\b(condition|conditions)\b/.test(text)) {
      return customerMap.conditions
    }

    if (
      /\b(expiry|expiration|expires|valid until)\b/.test(text) ||
      (/\bdate\b/.test(text) && /\b(expiry|expiration)\b/.test(text))
    ) {
      return customerMap['expiry date']
    }

    if (/\b(issuing state|state of issue|licence state|license state)\b/.test(text)) {
      return customerMap['issuing state']
    }

    if (/\b(state|province)\b/.test(text) && !/\bstatement\b/.test(text)) {
      return customerMap.state
    }

    if (/\b(signature date|date signed|signed date)\b/.test(text)) {
      return customerMap['signature date']
    }

    return ''
  }

  const applyCustomerToForm = (customer: CustomerProfile) => {
    const customerMap = buildCustomerFieldMap(customer)
    const targetModule = customerTargetModuleId
      ? formModules.find((module) => module.id === customerTargetModuleId)
      : null
    const targetFieldKeys = new Set(
      targetModule?.fields.map((field) => field.key) || []
    )
    const fieldsToMap = targetModule
      ? targetModule.fields.map((field) => ({
          name: field.key,
          label: field.label,
        }))
      : pdfFields

    setFormData((prev) => {
      const next = { ...prev }

      Object.keys(prev).forEach((fieldKey) => {
        if (targetModule && !targetFieldKeys.has(fieldKey)) return

        const normalized = normalizeFieldName(fieldKey)
        const matchedValue = customerMap[normalized as keyof typeof customerMap]

        if (matchedValue) {
          next[fieldKey] = matchedValue
        }
      })

      fieldsToMap.forEach((field) => {
        const fieldLabel = 'label' in field ? field.label : ''
        const normalizedFieldText = normalizeFieldName(
          `${field.name} ${fieldLabel}`
        )
        const documentKind = getCustomerDocumentKind(customer)

        if (
          (documentKind === 'licence' && /\bpassport\b/.test(normalizedFieldText)) ||
          (documentKind === 'passport' &&
            (/\b(driver'?s?\s*)?(licence|license)\b|\bdl\b/.test(normalizedFieldText)))
        ) {
          next[field.name] = ''
          return
        }

        const matchedValue = getCustomerValueForField(field, customer, customerMap)

        if (matchedValue) {
          next[field.name] = matchedValue
        }
      })

      return next
    })

    setSelectedCustomerId(customer.id)
    setShowCustomerPicker(false)
    setCustomerTargetModuleId(null)
    setMessage(
      targetModule
        ? `${text.filledModule}${getLocalizedModuleTitle(targetModule.title)}`
        : `${text.filledCustomer}${customer.customer_name || text.unnamedCustomer}`
    )
  }

  const loadStoredCustomers = async (targetModuleId?: string) => {
    setCustomerTargetModuleId(targetModuleId || null)
    setLoadingCustomers(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert(text.loginRequired)
        return
      }

      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setStoredCustomers(data || [])
      setShowCustomerPicker(true)
    } catch (error: unknown) {
      console.error(error)
      alert(getErrorMessage(error, text.readCustomersFailed))
    } finally {
      setLoadingCustomers(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      const { user, isAdmin } = await getCurrentAdminUser()

      if (!user) {
        router.push('/login')
        return
      }

      if (!isAdmin) {
        alert(language === 'zh' ? '此账号不是管理员。' : 'This account is not authorized as an administrator.')
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      setEmail(user.email ?? null)

      const { data, error } = await supabase
        .from('profiles')
        .select('name, company, address, phone')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile({
          name: data.name ?? '',
          company: data.company ?? '',
          address: data.address ?? '',
          phone: data.phone ?? '',
        })
      }

      if (error && error.code !== 'PGRST116') {
        console.error(error)
      }

      setLoading(false)
    }

    loadData()
  }, [language, router])

  useEffect(() => {
    const loadFields = async () => {
      if (!filePath) {
        setLoadingFields(false)
        return
      }

      try {
        setLoadingFields(true)
        setMessage('')
        setSelectedModuleIds([])
        const fields = await getPdfFields(filePath)
        setPdfFields(fields)
      } catch (err: unknown) {
        console.error(err)
        setMessage(text.readFieldsFailed + getErrorMessage(err, text.unknownError))
      } finally {
        setLoadingFields(false)
      }
    }

    loadFields()
  }, [filePath, text.readFieldsFailed, text.unknownError])

  useEffect(() => {
    const loadGeneratedRecord = async () => {
      if (!generatedId) {
        setGeneratedRecord(null)
        return
      }

      const { data, error } = await supabase
        .from('generated_pdfs')
        .select('id, user_id, source_pdf_path, generated_pdf_path, file_name, form_data, selected_module_ids, revision')
        .eq('id', generatedId)
        .single()

      if (error) {
        setMessage(text.readFieldsFailed + error.message)
        return
      }

      setGeneratedRecord(data)
      setFormData((data.form_data || {}) as Record<string, string>)
      setPendingModuleIds(data.selected_module_ids || [])
    }

    loadGeneratedRecord()
  }, [generatedId, text.readFieldsFailed])

  useEffect(() => {
    setSelectedModuleIds((prev) => {
      const availableIds = formModules.map((module) => module.id)
      const available = new Set(availableIds)
      return prev.filter((id) => available.has(id))
    })
  }, [formModules])

  useEffect(() => {
    if (!pendingModuleIds || formModules.length === 0) return

    const availableIds = new Set(formModules.map((module) => module.id))
    setSelectedModuleIds(pendingModuleIds.filter((id) => availableIds.has(id)))
    setPendingModuleIds(null)
  }, [formModules, pendingModuleIds])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-600">
          {language === 'zh' ? '正在加载填写页面...' : 'Loading fill page...'}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-16">
          <BackButton label={text.back} className="fixed left-8 top-8 z-50" />
        </div>


        <div className="rounded-2xl bg-white p-8 shadow">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">
              {language === 'zh' ? 'PDF 自动填写' : 'PDF Auto Fill'}
            </h1>
            <LanguageToggle language={language} onToggle={toggleLanguage} />
          </div>
          <p className="mb-2 text-gray-600">
            {language === 'zh' ? '当前账号：' : 'Current account: '}
            {email}
          </p>
          <p className="break-all text-gray-600">
            {language === 'zh' ? '当前文件：' : 'Current file: '}
            {filePath || (language === 'zh' ? '未选择文件' : 'No file selected')}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <h2 className="mb-4 text-2xl font-semibold">
            {language === 'zh' ? '资料库数据' : 'Profile Data'}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">
                {language === 'zh' ? '姓名' : 'Name'}
              </p>
              <p className="font-medium">
                {profile.name || (language === 'zh' ? '未填写' : 'Not filled')}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">
                {language === 'zh' ? '公司名称' : 'Company'}
              </p>
              <p className="font-medium">
                {profile.company || (language === 'zh' ? '未填写' : 'Not filled')}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">
                {language === 'zh' ? '地址' : 'Address'}
              </p>
              <p className="font-medium">
                {profile.address || (language === 'zh' ? '未填写' : 'Not filled')}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">
                {language === 'zh' ? '电话' : 'Phone'}
              </p>
              <p className="font-medium">
                {profile.phone || (language === 'zh' ? '未填写' : 'Not filled')}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="mb-2 text-2xl font-semibold">
                {language === 'zh' ? '自动识别结果' : 'Detected Form Structure'}
              </h2>

              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  {language === 'zh' ? '原始 PDF 字段数：' : 'Raw PDF fields: '}
                  {pdfFields.length}
                </p>
                <p>
                  {language === 'zh' ? '生成模块数：' : 'Generated modules: '}
                  {formModules.length}
                </p>
                <p>
                  {language === 'zh' ? '可填写字段数：' : 'Fillable fields: '}
                  {totalRenderedFields}
                </p>
              </div>
            </div>

            <div className="relative flex flex-col items-end gap-3">
              <button
                type="button"
                onClick={() => loadStoredCustomers()}
                disabled={loadingCustomers}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loadingCustomers
                  ? text.loading
                  : language === 'zh'
                    ? '选择客户'
                    : 'Choose Customer'}
              </button>

              {selectedCustomerId && (
                <p className="text-sm text-green-600">
                  {language === 'zh' ? '已选择客户' : 'Customer selected'}
                </p>
              )}

              {showCustomerPicker && (
                <div className="fixed right-8 top-24 z-50 w-[380px] rounded-2xl border bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800">
                      {customerTargetModuleId
                        ? language === 'zh'
                          ? '选择客户填入当前模块'
                          : 'Choose Customer for This Module'
                        : language === 'zh'
                          ? '已存储客户信息'
                          : 'Stored Customer Info'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomerPicker(false)
                        setCustomerTargetModuleId(null)
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      {language === 'zh' ? '关闭' : 'Close'}
                    </button>
                  </div>

                  {storedCustomers.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {language === 'zh' ? '暂无客户资料' : 'No customer profiles yet'}
                    </p>
                  ) : (
                    <div className="max-h-[320px] space-y-3 overflow-y-auto">
                      {storedCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => applyCustomerToForm(customer)}
                          className="w-full rounded-xl border bg-gray-50 px-4 py-4 text-left hover:bg-gray-100"
                        >
                          <div className="font-semibold text-gray-900">
                            {customer.customer_name ||
                              (language === 'zh' ? '未命名客户' : 'Unnamed Customer')}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {customer.document_number ||
                              (language === 'zh' ? '无证件号' : 'No document number')}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-gray-400">
                            {customer.address ||
                              (language === 'zh' ? '无地址' : 'No address')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {loadingFields ? (
            <p className="text-gray-500">{text.readingFields}</p>
          ) : pdfFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
              <p className="text-gray-600">{text.noFields}</p>
            </div>
          ) : formModules.length === 0 ? (
            <p className="text-gray-500">{text.noModules}</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border bg-gray-50 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {text.moduleSelection}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedModuleIds(formModules.map((module) => module.id))
                      }
                      className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100"
                    >
                      {text.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedModuleIds([])}
                      className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100"
                    >
                      {text.clear}
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  {groupedFormModules.map((group) => (
                    <section
                      key={group.section}
                      className="rounded-2xl border border-gray-300 bg-white p-5"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="text-xl font-bold text-gray-900">
                          {group.section === 'Other'
                            ? text.unclassified
                            : language === 'zh'
                              ? `${group.section} ${text.section}`
                              : `${text.section} ${group.section}`}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="mr-2 text-sm text-gray-500">
                            {group.modules.reduce(
                              (sum, module) => sum + module.fields.length,
                              0
                            )} {text.items}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedModuleIds((prev) =>
                                Array.from(
                                  new Set([
                                    ...prev,
                                    ...group.modules.map((module) => module.id),
                                  ])
                                )
                              )
                            }
                            className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100"
                          >
                            {text.selectAll}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedModuleIds((prev) =>
                                prev.filter(
                                  (id) =>
                                    !group.modules.some((module) => module.id === id)
                                )
                              )
                            }
                            className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100"
                          >
                            {text.clear}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {group.modules.map((module) => (
                          <label
                            key={module.id}
                            className="flex min-h-16 cursor-pointer items-center justify-between rounded-xl border bg-gray-50 px-4 py-3 text-sm hover:bg-gray-100"
                          >
                            <span className="font-medium text-gray-800">
                              {getLocalizedModuleTitle(module.title)}
                            </span>
                            <span className="flex items-center gap-3 text-gray-500">
                              {module.fields.length} {text.items}
                              <input
                                type="checkbox"
                                checked={selectedModuleIds.includes(module.id)}
                                onChange={() => toggleModule(module.id)}
                                className="h-4 w-4"
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="hidden">
                  {groupedFormModules.flatMap((group) => group.modules).map((module) => (
                    <label
                      key={module.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-800">
                        {getLocalizedModuleTitle(module.title)}
                      </span>
                      <span className="flex items-center gap-3 text-gray-500">
                        {module.fields.length} {text.items}
                        <input
                          type="checkbox"
                          checked={selectedModuleIds.includes(module.id)}
                          onChange={() => toggleModule(module.id)}
                          className="h-4 w-4"
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {visibleFormModules.length === 0 ? (
                <p className="rounded-xl border bg-gray-50 p-4 text-gray-500">
                  {text.selectAtLeastOne}
                </p>
              ) : visibleFormModules.map((module) => (
                <div
                  key={module.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">
                      {getLocalizedModuleTitle(module.title)}
                    </h3>
                    {isCustomerMappableModule(module.id) && (
                      <button
                        type="button"
                        onClick={() => loadStoredCustomers(module.id)}
                        disabled={loadingCustomers}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {loadingCustomers && customerTargetModuleId === module.id
                          ? text.loading
                          : text.chooseCustomer}
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {module.fields.map((field) => {
                      const localizedLabel = getDisplayFieldLabel(
                        module.title,
                        field.label,
                        module.id
                      )

                      return (
                      <div key={field.key}>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          {localizedLabel}
                        </label>

                        {field.type === 'text' && (
                          <input
                            type="text"
                            className="w-full rounded-xl border px-4 py-3"
                            placeholder={`${text.inputPrefix} ${localizedLabel}`}
                            value={formData[field.key] || ''}
                            onChange={(e) =>
                              handleFieldChange(field.key, e.target.value)
                            }
                          />
                        )}

                        {field.type === 'date' && (
                          <input
                            type="date"
                            className="w-full rounded-xl border px-4 py-3"
                            value={toDateInputValue(formData[field.key] || '')}
                            onChange={(e) =>
                              handleFieldChange(
                                field.key,
                                fromDateInputValue(e.target.value)
                              )
                            }
                          />
                        )}

                        {field.type === 'single_choice' && (
                          <div className="space-y-2">
                            {(field.options || []).map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="radio"
                                  name={field.key}
                                  value={opt}
                                  checked={formData[field.key] === opt}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {field.type === 'multi_choice' && (
                          <div>
                            <select
                              multiple
                              className="min-h-[180px] w-full rounded-xl border px-4 py-3"
                              value={(formData[field.key] || '')
                                .split('||')
                                .filter(Boolean)}
                              onChange={(e) => {
                                const selectedValues = Array.from(
                                  e.target.selectedOptions
                                ).map((option) => option.value)

                                handleFieldChange(
                                  field.key,
                                  selectedValues.join('||')
                                )
                              }}
                            >
                              {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>

                            <p className="mt-2 text-sm text-gray-500">
                              {text.multiSelectHint}
                            </p>
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <h2 className="mb-4 text-2xl font-semibold">{text.filledContent}</h2>
          {filledFormPreview.length === 0 ? (
            <p className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-500">
              {text.noFilledContent}
            </p>
          ) : (
            <div className="space-y-4">
              {filledFormPreview.map((module) => (
                <section
                  key={module.id}
                  className="rounded-xl border bg-gray-50 p-4"
                >
                  <h3 className="mb-3 text-base font-semibold text-gray-900">
                    {module.title}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {module.fields.map((field, index) => (
                      <div
                        key={`${field.label}-${index}`}
                        className="rounded-lg bg-white p-3"
                      >
                        <div className="text-xs font-medium text-gray-500">
                          {field.label}
                        </div>
                        <div className="mt-1 break-words text-sm text-gray-900">
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <h2 className="mb-4 text-2xl font-semibold">{text.generatePdf}</h2>

          <button
            onClick={async () => {
              if (!filePath) {
                alert(text.noFileSelected)
                return
              }

              try {
                setMessage(text.generating)

                const pdfBytes = await fillPdf({
                  fileName: filePath,
                  profile,
                  formData,
                  activeFieldNames,
                })

                const blob = new Blob([pdfBytes as BlobPart], {
                  type: 'application/pdf',
                })

                await saveGeneratedPdfRecord(pdfBytes)

                const url = URL.createObjectURL(blob)

                const a = document.createElement('a')
                a.href = url
                a.download = language === 'zh' ? '已填写表单.pdf' : 'filled-form.pdf'
                a.click()

                URL.revokeObjectURL(url)
                setMessage(text.generated)
              } catch (err: unknown) {
                console.error('PDF生成错误:', err)
                setMessage(text.generateFailed + getErrorMessage(err, text.unknownError))
                alert(text.generateFailed + getErrorMessage(err, text.unknownError))
              }
            }}
            className="w-full rounded-xl bg-purple-600 px-6 py-4 text-lg text-white hover:bg-purple-700"
          >
            {text.generateButton}
          </button>

          {message && (
            <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function FillPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-100">
          <p className="text-lg text-gray-600">Loading fill page...</p>
        </main>
      }
    >
      <FillPageContent />
    </Suspense>
  )
}
