// src/lib/pdf-to-form.ts

export type PdfField = {
  name: string
  type?: string
  label?: string
  pageIndex?: number
  x?: number
  y?: number
  width?: number
  height?: number
  pdfOrder?: number
}

export type FormField = {
  key: string
  label: string
  type: 'text' | 'date' | 'single_choice' | 'multi_choice'
  options?: string[]
  placeholder?: string
  pageIndex?: number
  x?: number
  y?: number
  width?: number
  height?: number
  pdfOrder?: number
}

export type FormModule = {
  id: string
  title: string
  fields: FormField[]
}

function cleanLabel(name: string) {
  return name
    .replace(/_af_date$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDateField(name: string) {
  return /date|dob|expiry/i.test(name) || /_af_date$/i.test(name)
}

function isSignatureBoxField(name: string, label?: string) {
  const fieldName = name.trim()
  const fieldLabel = label?.trim() || ''
  return /^signature(?:[_\s-]*\d+)?$/i.test(fieldName) || /^signature$/i.test(fieldLabel)
}

function convertNormalField(field: PdfField): FormField | null {
  const name = field.name?.trim()
  if (!name) return null
  const label = field.label?.trim() || cleanLabel(name)
  const position = {
    pageIndex: field.pageIndex,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    pdfOrder: field.pdfOrder,
  }

  if (/^undefined(_\d+)?$/i.test(name)) return null
  if (/^[A-Z]:$/i.test(name)) return null
  if (isSignatureBoxField(name, field.label)) return null

  if (isDateField(name)) {
    return {
      key: name,
      label,
      type: 'date',
      ...position,
      placeholder: '请选择日期',
    }
  }

  return {
    key: name,
    label,
    type: 'text',
    ...position,
    placeholder: `请输入 ${cleanLabel(name)}`,
  }
}

function createModule(id: string, title: string, fields: FormField[]): FormModule {
  return {
    id,
    title,
    fields,
  }
}

export function convertPdfToForm(fields: PdfField[]): FormModule[] {
  const fieldNames = new Set(fields.map((f) => f.name))
  const used = new Set<string>()
  const modules: FormModule[] = []

  const markUsed = (...names: string[]) => {
    names.forEach((n) => used.add(n))
  }

  const pushRemainingModule = (id: string, title: string, matchers: RegExp[]) => {
    const matched = fields
      .filter((f) => !used.has(f.name))
      .filter((f) => matchers.some((r) => r.test(f.name)))
      .map(convertNormalField)
      .filter((f): f is FormField => Boolean(f))

    if (matched.length > 0) {
      matched.forEach((f) => used.add(f.key))
      modules.push(createModule(id, title, matched))
    }
  }

  const pushFieldsModule = (id: string, title: string, sourceFields: PdfField[]) => {
    const matched = sourceFields
      .filter((f) => !used.has(f.name))
      .map(convertNormalField)
      .filter((f): f is FormField => Boolean(f))

    if (matched.length > 0) {
      matched.forEach((f) => used.add(f.key))
      modules.push(createModule(id, title, matched))
    }
  }

  const findFieldIndex = (matcher: RegExp, startIndex = 0) => {
    return fields.findIndex((field, index) => index >= startIndex && matcher.test(field.name))
  }

  const getFieldRange = (startMatcher: RegExp, endMatcher: RegExp) => {
    const startIndex = findFieldIndex(startMatcher)
    if (startIndex < 0) return []

    const endIndex = findFieldIndex(endMatcher, startIndex + 1)
    return fields.slice(startIndex + 1, endIndex >= 0 ? endIndex : undefined)
  }

  // ========= Existing Investor 简版表单专项处理 =========
  // 判断依据：这几个字段是简版表单的典型字段
  const isExistingInvestorForm =
    fieldNames.has('Investor Name 1') ||
    fieldNames.has('Registered Address 1') ||
    fieldNames.has('Check Box1') ||
    fieldNames.has('Name Please Print')

  if (isExistingInvestorForm) {
    const investorDetails: FormField[] = []

    if (fieldNames.has('Investor Name 1')) {
      investorDetails.push({
        key: 'Investor Name 1',
        label: 'Registered Account Name - Line 1',
        type: 'text',
        placeholder: '请输入账户名称第 1 行',
      })
      markUsed('Investor Name 1')
    }

    if (fieldNames.has('Investor Name 2')) {
      investorDetails.push({
        key: 'Investor Name 2',
        label: 'Registered Account Name - Line 2',
        type: 'text',
        placeholder: '请输入账户名称第 2 行',
      })
      markUsed('Investor Name 2')
    }

    if (fieldNames.has('Investor Name 3')) {
      investorDetails.push({
        key: 'Investor Name 3',
        label: 'Registered Account Name - Line 3',
        type: 'text',
        placeholder: '请输入账户名称第 3 行',
      })
      markUsed('Investor Name 3')
    }

    if (fieldNames.has('Registered Address 1')) {
      investorDetails.push({
        key: 'Registered Address 1',
        label: 'Registered Address - Line 1',
        type: 'text',
        placeholder: '请输入地址第 1 行',
      })
      markUsed('Registered Address 1')
    }

    if (fieldNames.has('Registered Address 2')) {
      investorDetails.push({
        key: 'Registered Address 2',
        label: 'Registered Address - Line 2',
        type: 'text',
        placeholder: '请输入地址第 2 行',
      })
      markUsed('Registered Address 2')
    }

    if (fieldNames.has('Registered Address 3')) {
      investorDetails.push({
        key: 'Registered Address 3',
        label: 'Registered Address - Line 3',
        type: 'text',
        placeholder: '请输入地址第 3 行',
      })
      markUsed('Registered Address 3')
    }

    if (fieldNames.has('Postcode')) {
      investorDetails.push({
        key: 'Postcode',
        label: 'Postcode',
        type: 'text',
        placeholder: '请输入 Postcode',
      })
      markUsed('Postcode')
    }

    if (fieldNames.has('Telephone Number')) {
      investorDetails.push({
        key: 'Telephone Number',
        label: 'Telephone Number',
        type: 'text',
        placeholder: '请输入电话号码',
      })
      markUsed('Telephone Number')
    }

    if (fieldNames.has('Investor Number')) {
      investorDetails.push({
        key: 'Investor Number',
        label: 'Investor Number',
        type: 'text',
        placeholder: '请输入 Investor Number',
      })
      markUsed('Investor Number')
    }

    if (fieldNames.has('Application Amount')) {
      investorDetails.push({
        key: 'Application Amount',
        label: 'Application Amount',
        type: 'text',
        placeholder: '请输入申请金额',
      })
      markUsed('Application Amount')
    }

    if (investorDetails.length > 0) {
      modules.push(
        createModule('existing-investor-details', 'Investor Details', investorDetails)
      )
    }

    // Source of Funds 合并为一个多选题
    const hasSourceOfFunds =
      fieldNames.has('Check Box1') ||
      fieldNames.has('Check Box2') ||
      fieldNames.has('Check Box3') ||
      fieldNames.has('Check Box4') ||
      fieldNames.has('Check Box5') ||
      fieldNames.has('Check Box6')

    if (hasSourceOfFunds) {
      modules.push(
        createModule('source-of-funds', 'Source of Funds', [
          {
            key: 'source_of_funds',
            label: 'Source of Funds',
            type: 'multi_choice',
            options: [
              'Investments',
              'Business Activity',
              'Other',
              'Gainful Employment',
              'Inheritance/Gift',
              'Superannuation',
            ],
          },
        ])
      )

      markUsed(
        'Check Box1',
        'Check Box2',
        'Check Box3',
        'Check Box4',
        'Check Box5',
        'Check Box6'
      )
    }

    const depositFields: FormField[] = []

    if (fieldNames.has('Deposit Reference')) {
      depositFields.push({
        key: 'Deposit Reference',
        label: 'Deposit Reference',
        type: 'text',
        placeholder: '请输入打款备注',
      })
      markUsed('Deposit Reference')
    }

    if (depositFields.length > 0) {
      modules.push(createModule('deposit-details', 'Deposit Details', depositFields))
    }

    const signFields: FormField[] = []

    if (fieldNames.has('Name Please Print')) {
      signFields.push({
        key: 'Name Please Print',
        label: 'Signer Name 1',
        type: 'text',
        placeholder: '请输入签字人 1',
      })
      markUsed('Name Please Print')
    }

    if (fieldNames.has('Date7_af_date')) {
      signFields.push({
        key: 'Date7_af_date',
        label: 'Date 1',
        type: 'date',
      })
      markUsed('Date7_af_date')
    }

    if (fieldNames.has('Name Please Print_2')) {
      signFields.push({
        key: 'Name Please Print_2',
        label: 'Signer Name 2',
        type: 'text',
        placeholder: '请输入签字人 2',
      })
      markUsed('Name Please Print_2')
    }

    if (fieldNames.has('Date8_af_date')) {
      signFields.push({
        key: 'Date8_af_date',
        label: 'Date 2',
        type: 'date',
      })
      markUsed('Date8_af_date')
    }

    if (signFields.length > 0) {
      modules.push(createModule('signatures', 'Signatures', signFields))
    }
  }

  // ========= 下面是通用兜底分组 =========

  pushRemainingModule('basic', 'A - 基本信息 / Basic Information', [
    /^Your Email Address$/i,
    /^Full Name$/i,
    /^Contact Phone Number$/i,
  ])

  pushRemainingModule('application-type', 'A - 申请类型与资金来源 / Application Type and Source of Funds', [
    /^Application Type/i,
    /^Application Type - Other$/i,
    /^Gainful Employment$/i,
    /^Business Activity$/i,
    /^Inheritance\/Gift$/i,
    /^Superannuation$/i,
    /^Savings$/i,
    /^Financial Investments$/i,
    /^Source of Funds Other/i,
    /^Source of Funds Other 1$/i,
    /^I am filling in this application as/i,
  ])

  pushRemainingModule('applicant-1', 'A - 申请人 1 / Applicant 1', [/^Applicant 1\b/i])
  pushRemainingModule('applicant-2', 'A - 申请人 2 / Applicant 2', [/^Applicant 2\b/i])

  pushRemainingModule('company', 'B - 公司 / Company or Corporate Trustee', [
    /^Full name of the Company or Corporate Trustee$/i,
    /^Company\b/i,
    /^Total number of Directors$/i,
  ])

  pushRemainingModule('director-1', 'B - 董事 1 / Director 1', [/^Director 1\b/i])
  pushRemainingModule('director-2', 'B - 董事 2 / Director 2', [/^Director 2\b/i])
  pushRemainingModule('director-3', 'B - 董事 3 / Director 3', [/^Director 3\b/i])

  pushRemainingModule('beneficial-owner-1', 'B - 受益所有人 1 / Beneficial Owner 1', [
    /^Beneficial Owner 1\b/i,
  ])
  pushRemainingModule('beneficial-owner-2', 'B - 受益所有人 2 / Beneficial Owner 2', [
    /^Beneficial Owner 2\b/i,
  ])
  pushRemainingModule('beneficial-owner-3', 'B - 受益所有人 3 / Beneficial Owner 3', [
    /^Beneficial Owner 3\b/i,
  ])

  pushRemainingModule('partnership', 'C - 合伙企业 / Partnership', [
    /^Full Name of Partnership$/i,
    /^Partnership\b/i,
    /^Regulation information$/i,
    /^Association name$/i,
    /^Association website$/i,
    /^Partner’s membership number\/reference$/i,
  ])
  pushRemainingModule('partner-1', 'C - 合伙人 1 / Partner 1', [/^Partner 1\b/i])
  pushRemainingModule('partner-2', 'C - 合伙人 2 / Partner 2', [/^Partner 2\b/i])

  pushRemainingModule('trust', 'D - 信托 / Trust / Superannuation Funds', [
    /^Full name of Trust \/ Superannuation fund$/i,
    /^Tax File Number or Reason for Exemption$/i,
    /^The country where Trust was established$/i,
    /^Full Business Name \(if any\) of the Trustee$/i,
    /^Self-Managed Superannuation Fund/i,
    /^Registered Managed Investment Scheme/i,
    /^Other Regulated Trust/i,
    /^Type of Unregulated Trust/i,
    /^Beneficiary Details$/i,
    /^Total number of beneficiaries$/i,
    /^The full name of the Settlor$/i,
    /^BENEFICIAL OWNER\(S\) \/ CONTROLLER OF THE TRUST$/i,
    /^Please provide RegistrationLicensing Details$/i,
    /^If neither of these applies/i,
  ])
  const beneficiaryDetailFields = getFieldRange(
    /^Beneficiary Details$/i,
    /^The full name of the Settlor$/i
  ).filter((field) => !/^Total number of beneficiaries$/i.test(field.name))

  if (beneficiaryDetailFields.length > 0) {
    const beneficiaryChunkSize = 25
    for (let index = 0; index < beneficiaryDetailFields.length; index += beneficiaryChunkSize) {
      const beneficiaryNumber = Math.floor(index / beneficiaryChunkSize) + 1
      if (beneficiaryNumber > 3) break

      pushFieldsModule(
        `trust-beneficiary-${beneficiaryNumber}`,
        `D - 信托受益人 ${beneficiaryNumber} / Beneficiary ${beneficiaryNumber}`,
        beneficiaryDetailFields.slice(index, index + beneficiaryChunkSize)
      )
    }
  }

  pushRemainingModule('trust-beneficiary-1', 'D - 信托受益人 1 / Beneficiary 1', [
    /^Trust\/Superfund Beneficiar(?:y|ie) 1\b/i,
    /^Trust Beneficiar(?:y|ie) 1\b/i,
    /^Beneficiar(?:y|ie) 1\b/i,
    /^Trust Beneficiary Details 1\b/i,
    /^Trust\/Superfund Beneficiary Details 1\b/i,
  ])
  pushRemainingModule('trust-beneficiary-2', 'D - 信托受益人 2 / Beneficiary 2', [
    /^Trust\/Superfund Beneficiar(?:y|ie) 2\b/i,
    /^Trust Beneficiar(?:y|ie) 2\b/i,
    /^Beneficiar(?:y|ie) 2\b/i,
    /^Trust Beneficiary Details 2\b/i,
    /^Trust\/Superfund Beneficiary Details 2\b/i,
  ])
  pushRemainingModule('trust-beneficiary-3', 'D - 信托受益人 3 / Beneficiary 3', [
    /^Trust\/Superfund Beneficiar(?:y|ie) 3\b/i,
    /^Trust Beneficiar(?:y|ie) 3\b/i,
    /^Beneficiar(?:y|ie) 3\b/i,
    /^Trust Beneficiary Details 3\b/i,
    /^Trust\/Superfund Beneficiary Details 3\b/i,
  ])
  pushRemainingModule('trust-owner-controller-1', 'D - 受益所有人 1 / Beneficial Owner 1', [
    /^Beneficial Owner 1\b/i,
    /^Beneficial Owner\/Controller 1\b/i,
    /^Beneficial Owner or Controller 1\b/i,
    /^BO\/Controller of Trust 1\b/i,
  ])
  pushRemainingModule('trust-owner-controller-2', 'D - 受益所有人 2 / Beneficial Owner 2', [
    /^Beneficial Owner 2\b/i,
    /^Beneficial Owner\/Controller 2\b/i,
    /^Beneficial Owner or Controller 2\b/i,
    /^BO\/Controller of Trust 2\b/i,
  ])
  pushRemainingModule('trust-owner-controller-3', 'D - 受益所有人 3 / Beneficial Owner 3', [
    /^Beneficial Owner 3\b/i,
    /^Beneficial Owner\/Controller 3\b/i,
    /^Beneficial Owner or Controller 3\b/i,
    /^BO\/Controller of Trust 3\b/i,
  ])

  pushRemainingModule('pep', '政治公众人物 / Politically Exposed Person (PEP)', [
    /^Is the Applicant a Politically Exposed Person/i,
    /^member or close associate of a PEP$/i,
  ])

  pushRemainingModule('fatca-individual', '税务信息（个人）/ Individual FATCA / CRS', [
    /^A:$/i,
    /^TAX RESIDENCE – INDIVIDUAL\/SOLE TRADER/i,
    /^Applicant 1 - TIN/i,
    /^Applicant 2 - TIN/i,
    /^Applicant 1 - Taxpayer Identification Number/i,
    /^Applican 2 - Taxpayer Identification Number/i,
    /^Country of Residence/i,
    /^Taxpayer Identification Number \(TIN\)/i,
    /^Taxpayer Identification Number TIN/i,
    /^TIN Unavailable/i,
    /^TIN Unavailable Explanation/i,
    /^I certify that the tax residence countries provided represent all countries/i,
    /^Is the Applicant a US person\?/i,
  ])

  pushRemainingModule('fatca-entity', '税务信息（实体）/ Entity FATCA / CRS', [
    /^B:$/i,
    /^Company TIN Unavailable/i,
    /^Company Certification$/i,
    /^FATCA STATUS – COMPANIES/i,
    /^Select a classification that matches your FATCA/i,
    /^Select a deemed-compliant category$/i,
    /^APPLICANTS GLOBAL INTERMEDIARY IDENTIFICATION NUMBER GIIN$/i,
    /^Financial Institution$/i,
    /^Non-Financial Entity/i,
    /^Name of Securities Market$/i,
    /^Name of the Related Entity$/i,
    /^Other – describe the FATCA status$/i,
    /^Other  describe the CRS Status$/i,
    /^CP&BO1/i,
    /^CP&BO2/i,
  ])

  pushRemainingModule('distribution', '分配 / Distribution Payment Account', [
    /^Method of Payment$/i,
    /^DISTRIBUTION PAYMENT DETAILS$/i,
    /^Bank Name$/i,
    /^Account Name$/i,
    /^BSB Number$/i,
    /^Account Number$/i,
  ])

  pushRemainingModule('reporting', '报告联系人 / Reporting Contacts', [
    /^Please indicate your preferred email address/i,
    /^Reporting\b/i,
    /^Secondary Contact Name$/i,
    /^Secondary Contact Email$/i,
    /^Third Contact Name$/i,
    /^Third Contact Email$/i,
    /^Fourth Contact Name$/i,
    /^Fourth Contact Email$/i,
    /^Accountant Name$/i,
    /^Accountant Email$/i,
    /^Mobile_[3-7]$/i,
    /^Accountant Phone \(Work\)$/i,
  ])

  pushRemainingModule('adviser', '顾问信息 / Adviser Information', [
    /^Dealer Group$/i,
    /^Dealer Group AFSL$/i,
    /^Adviser Firm$/i,
    /^Adviser Firm AFSL$/i,
    /^Authorised Representative/i,
    /^Adviser Name$/i,
    /^Adviser Email/i,
    /^Adviser Phone No$/i,
  ])

  pushRemainingModule('accountant-certificate', '会计师证明 / Accountant Certificate', [
    /^Name of qualified accountant/i,
    /^Business address cannot be PO Box$/i,
    /^Investor Name$/i,
    /^Accountant Certificate - Investor Address/i,
    /^I comply with the continuing professional development requirements/i,
    /^Accountant decleration$/i,
  ])

  const signatureFields: FormField[] = []

  if (fieldNames.has('Name')) {
    signatureFields.push({
      key: 'Name',
      label: 'Name 1',
      type: 'text',
      placeholder: '请输入姓名 1',
    })
    markUsed('Name')
  }

  if (fieldNames.has('Date14_af_date')) {
    signatureFields.push({
      key: 'Date14_af_date',
      label: 'Date 1',
      type: 'date',
    })
    markUsed('Date14_af_date')
  }

  if (fieldNames.has('Name_2')) {
    signatureFields.push({
      key: 'Name_2',
      label: 'Name 2',
      type: 'text',
      placeholder: '请输入姓名 2',
    })
    markUsed('Name_2')
  }

  if (fieldNames.has('Date15_af_date')) {
    signatureFields.push({
      key: 'Date15_af_date',
      label: 'Date 2',
      type: 'date',
    })
    markUsed('Date15_af_date')
  }

  if (signatureFields.length > 0) {
    modules.push(createModule('signature', '签字信息 / Signatures', signatureFields))
  }

  // 其余字段兜底
  const remaining = fields
    .filter((f) => !used.has(f.name))
    .map(convertNormalField)
    .filter((f): f is FormField => Boolean(f))

  if (remaining.length > 0) {
    modules.push(createModule('others', '其他字段 / Other Fields', remaining))
  }

  return modules.filter((m) => m.fields.length > 0)
}
