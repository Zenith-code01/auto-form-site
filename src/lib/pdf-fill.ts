import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/src/lib/supabase'

type ProfileData = {
  name: string
  company: string
  address: string
  phone: string
}

type FillPdfParams = {
  fileName: string
  profile: ProfileData
  formData: Record<string, string>
  activeFieldNames?: string[]
}

function splitFullName(fullName: string) {
  const clean = (fullName || '').trim()

  if (!clean) {
    return {
      firstName: '',
      middleName: '',
      lastName: '',
    }
  }

  const parts = clean.split(/\s+/)

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: '',
    }
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: parts[1],
    }
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

function normalizeDate(value: string) {
  const input = (value || '').trim()
  if (!input) return ''

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
    return input
  }

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
      return `${dd}/${mm}/${yyyy}`
    }
  }

  return input
}

function normalizePlainText(value: string) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function getFirstValue(
  sources: Array<string | undefined | null>,
  fallback = ''
) {
  for (const item of sources) {
    const value = normalizePlainText(item || '')
    if (value) return value
  }
  return fallback
}

export async function fillPdf({
  fileName,
  profile,
  formData,
  activeFieldNames = [],
}: FillPdfParams): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from('pdf-forms')
    .download(fileName)

  if (error || !data) {
    throw new Error('无法下载原始 PDF 文件')
  }

  const existingPdfBytes = await data.arrayBuffer()
  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const form = pdfDoc.getForm()
  const pdfFields = form.getFields()
  const pdfFieldNames = pdfFields.map((field) => field.getName())
  const activeFields = new Set(activeFieldNames)
  const sourceOfFundsFields = new Set([
    'Gainful Employment',
    'Business Activity',
    'Inheritance/Gift',
    'Superannuation',
    'Savings',
    'Financial Investments',
    'Source of Funds Other',
    'Check Box1',
    'Check Box2',
    'Check Box3',
    'Check Box4',
    'Check Box5',
    'Check Box6',
  ])
  const canFillField = (name: string) => {
    if (activeFields.size === 0) return true
    return activeFields.has(name) || (
      activeFields.has('source_of_funds') && sourceOfFundsFields.has(name)
    )
  }

  // ===== 调试输出：看清 PDF 里到底有哪些字段 =====
  console.log('===== PDF FIELD NAMES START =====')
  console.log(pdfFieldNames)
  console.log('===== PDF FIELD NAMES END =====')

  const setTextField = (name: string, value: string) => {
    if (!canFillField(name)) return
    try {
      const field = form.getTextField(name)
      field.setText(value || '')
    } catch {
      console.warn('字段不存在或不是文本框:', name)
    }
  }

  const setDateField = (name: string, value: string) => {
    if (!canFillField(name)) return
    try {
      const field = form.getTextField(name)
      field.setText(normalizeDate(value || ''))
    } catch {
      console.warn('日期字段不存在或不是文本框:', name)
    }
  }

  const setCheckField = (name: string, checked: boolean) => {
    if (!canFillField(name)) return
    try {
      const field = form.getCheckBox(name)
      if (checked) {
        field.check()
      } else {
        field.uncheck()
      }
    } catch {
      console.warn('复选框字段不存在或不是 checkbox:', name)
    }
  }

  const setAnyField = (name: string, value: string) => {
    if (!normalizePlainText(value)) return
    if (/^signature(?:[_\s-]*\d+)?$/i.test(name.trim())) return

    if (/_af_date$/i.test(name) || /date|dob|expiry/i.test(name)) {
      setDateField(name, value)
      return
    }

    setTextField(name, value)
  }

  const setFirstExistingTextField = (candidateNames: string[], value: string) => {
    const finalValue = normalizePlainText(value)
    if (!finalValue) return false

    for (const fieldName of candidateNames) {
      if (pdfFieldNames.includes(fieldName) && canFillField(fieldName)) {
        setTextField(fieldName, finalValue)
        console.log(`已写入字段: ${fieldName} => ${finalValue}`)
        return true
      }
    }

    console.warn('这些候选字段都不存在:', candidateNames)
    return false
  }

  const lower = fileName.toLowerCase()

  // ===== 从客户资料库 / 页面表单提取标准化数据 =====
  const customerName = getFirstValue([
    formData['customer_name'],
    formData['Customer Name'],
    formData['Full Name'],
    formData['full_name'],
    profile.name,
  ])

  const customerDocumentNumber = getFirstValue([
    formData['document_number'],
    formData['Document Number'],
    formData['Licence Number'],
    formData['License Number'],
    formData['licence_number'],
    formData['license_number'],
    formData['Applicant 1 DL Number'],
  ])

  const customerDob = getFirstValue([
    formData['date_of_birth'],
    formData['Date of Birth'],
    formData['dob'],
    formData['DOB'],
    formData['Applicant 1 - DOB_af_date'],
  ])

  const customerAddress = getFirstValue([
    formData['address'],
    formData['Address'],
    formData['full_address'],
    formData['Applicant 1 - Street Name'],
    profile.address,
  ])

  const customerExpiry = getFirstValue([
    formData['expiry_date'],
    formData['Expiry Date'],
    formData['expiry'],
    formData['Applicant 1 - DL - Expiry Date_af_date'],
  ])

  const customerPhone = getFirstValue([
    formData['phone'],
    formData['Phone'],
    formData['Telephone Number'],
    formData['mobile'],
    formData['Applicant 1 - Phone'],
    profile.phone,
  ])

  const customerEmail = getFirstValue([
    formData['email'],
    formData['Email'],
    formData['Your Email Address'],
    formData['Applicant 1 - Email'],
  ])

  // ===== Conditions 多别名识别 =====
  const customerConditions = getFirstValue([
    formData['conditions'],
    formData['condition'],
    formData['Conditions'],
    formData['Condition'],
    formData['licence_conditions'],
    formData['license_conditions'],
    formData['Licence Conditions'],
    formData['License Conditions'],
    formData['driver_licence_conditions'],
    formData['Driver Licence Conditions'],
    formData['Applicant 1 - Conditions'],
  ])

  const customerIssuingState = getFirstValue([
    formData['issuing_state'],
    formData['Issuing State'],
    formData['State of Issue'],
    formData['licence_state'],
    formData['license_state'],
    formData['Licence State'],
    formData['License State'],
    formData['driver_licence_state'],
    formData['driver_license_state'],
    formData['Driver Licence State'],
    formData['Driver License State'],
    formData['Applicant 1 - Licence State'],
    formData['Applicant 1 - License State'],
  ])

  const { firstName, middleName, lastName } = splitFullName(customerName)

  // ===== Existing Investor 简版表单 =====
  if (lower.includes('existing investor')) {
    setTextField('Investor Name 1', formData['Investor Name 1'] || customerName)
    setTextField('Investor Name 2', formData['Investor Name 2'] || '')
    setTextField('Investor Name 3', formData['Investor Name 3'] || '')

    setTextField(
      'Registered Address 1',
      formData['Registered Address 1'] || customerAddress
    )
    setTextField('Registered Address 2', formData['Registered Address 2'] || '')
    setTextField('Registered Address 3', formData['Registered Address 3'] || '')

    setTextField('Postcode', formData['Postcode'] || '')
    setTextField(
      'Telephone Number',
      formData['Telephone Number'] || customerPhone
    )
    setTextField('Investor Number', formData['Investor Number'] || '')
    setTextField('Application Amount', formData['Application Amount'] || '')
    setTextField(
      'Deposit Reference',
      formData['Deposit Reference'] || customerName || profile.name || ''
    )

    setTextField(
      'Name Please Print',
      formData['Name Please Print'] || customerName
    )
    setTextField('Name Please Print_2', formData['Name Please Print_2'] || '')

    setDateField('Date7_af_date', formData['Date7_af_date'] || '')
    setDateField('Date8_af_date', formData['Date8_af_date'] || '')

    const selectedFunds = (formData['source_of_funds'] || '')
      .split('||')
      .map((s) => s.trim())
      .filter(Boolean)

    setCheckField('Check Box1', selectedFunds.includes('Investments'))
    setCheckField('Check Box2', selectedFunds.includes('Business Activity'))
    setCheckField('Check Box3', selectedFunds.includes('Other'))
    setCheckField('Check Box4', selectedFunds.includes('Gainful Employment'))
    setCheckField('Check Box5', selectedFunds.includes('Inheritance/Gift'))
    setCheckField('Check Box6', selectedFunds.includes('Superannuation'))
  } else {
    // ===== 新投资者 / 通用表单 =====

    // 顶部联络信息
    setTextField('Your Email Address', customerEmail)
    setTextField('Full Name', customerName)
    setTextField('Contact Phone Number', customerPhone)

    // Source of Funds
    const selectedFunds = (formData['source_of_funds'] || '')
      .split('||')
      .map((s) => s.trim())
      .filter(Boolean)

    if (selectedFunds.length > 0) {
      setCheckField('Gainful Employment', selectedFunds.includes('Gainful Employment'))
      setCheckField('Business Activity', selectedFunds.includes('Business Activity'))
      setCheckField('Inheritance/Gift', selectedFunds.includes('Inheritance/Gift'))
      setCheckField('Superannuation', selectedFunds.includes('Superannuation'))
      setCheckField('Savings', selectedFunds.includes('Savings'))
      setCheckField('Financial Investments', selectedFunds.includes('Financial Investments'))
      setCheckField('Source of Funds Other', selectedFunds.includes('Other'))
    }

    // Applicant 1
    setTextField('Applicant 1 - First Name', formData['Applicant 1 - First Name'] || firstName)
    setTextField('Applicant 1 - Middle Name', formData['Applicant 1 - Middle Name'] || middleName)
    setTextField('Applicant 1 - Last Name', formData['Applicant 1 - Last Name'] || lastName)

    setDateField('Applicant 1 - DOB_af_date', customerDob)

    // 驾照
    setTextField('Applicant 1 DL Number', customerDocumentNumber)
    setDateField('Applicant 1 - DL - Expiry Date_af_date', customerExpiry)

    // 地址
    setTextField('Applicant 1 - Street Name', customerAddress)
    setTextField('Applicant 1 - Country', formData['Applicant 1 - Country'] || 'Australia')

    // 电话 / 邮箱
    setTextField('Applicant 1 - Phone', customerPhone)
    setTextField('Applicant 1 - Mobile', customerPhone)
    setTextField('Applicant 1 - Email', customerEmail)

    // ===== Conditions 自动尝试写入 =====
    setFirstExistingTextField(
      [
        'Conditions',
        'Condition',
        'conditions',
        'condition',
        'Licence Conditions',
        'License Conditions',
        'Driver Licence Conditions',
        'Applicant 1 - Conditions',
      ],
      customerConditions
    )

    setFirstExistingTextField(
      [
        'Issuing State',
        'State of Issue',
        'Licence State',
        'License State',
        'Driver Licence State',
        'Driver License State',
        'Applicant 1 - Licence State',
        'Applicant 1 - License State',
      ],
      customerIssuingState
    )

    // 公司兜底
    setTextField(
      'Company / Corporate Trustee',
      formData['Company / Corporate Trustee'] || profile.company || ''
    )
    setTextField(
      'Full name of the Company or Corporate Trustee',
      formData['Full name of the Company or Corporate Trustee'] || profile.company || ''
    )

    // Reporting
    setTextField('Reporting 1 - Email Address', customerEmail)
    setTextField('Reporting 1 - Phone (Work)', customerPhone)

    // 银行
    setTextField('Bank Name', formData['Bank Name'] || '')

    // 签名页
    setTextField('Name', formData['Name'] || customerName)
    setDateField(
      'Date14_af_date',
      formData['Date14_af_date'] ||
        new Date().toLocaleDateString('en-GB')
    )
  }

  // ===== 最后再做一次通用补写 =====
  Object.entries(formData).forEach(([key, value]) => {
    if (!normalizePlainText(value)) return
    if (key === 'source_of_funds') return
    if (!canFillField(key)) return
    setAnyField(key, value)
  })

  try {
    form.updateFieldAppearances()
  } catch {
    console.warn('updateFieldAppearances 失败，但不影响导出')
  }

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
