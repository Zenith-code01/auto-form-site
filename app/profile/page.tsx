'use client'

import { useCallback, useEffect, useState, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'

import BackButton from '@/src/components/BackButton'
import LanguageToggle from '@/src/components/LanguageToggle'
import ModalShell from '@/src/components/ModalShell'
import { useLanguage } from '@/src/lib/use-language'
import { getCurrentAdminUser } from '@/src/lib/admin'

type CustomerProfile = {
  id: string
  customer_name: string
  document_type: string
  document_number: string
  date_of_birth: string
  address: string
  expiry_date: string
  photo_url: string
  created_at: string
  card_number?: string
  licence_class?: string
  conditions?: string
  issuing_state?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function getStoragePathFromPublicUrl(publicUrl: string, bucketName: string) {
  if (!publicUrl) return ''

  const marker = `/storage/v1/object/public/${bucketName}/`
  const markerIndex = publicUrl.indexOf(marker)
  if (markerIndex === -1) return ''

  const pathWithQuery = publicUrl.slice(markerIndex + marker.length)
  return decodeURIComponent(pathWithQuery.split('?')[0] || '')
}

async function upscaleImageForOcr(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  try {
    const imageUrl = URL.createObjectURL(file)
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = imageUrl
    })

    const scale = Math.max(3, Math.ceil(1400 / Math.max(image.width, 1)))
    const canvas = document.createElement('canvas')
    canvas.width = image.width * scale
    canvas.height = image.height * scale

    const context = canvas.getContext('2d')
    if (!context) {
      URL.revokeObjectURL(imageUrl)
      return file
    }

    context.imageSmoothingEnabled = false
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(imageUrl)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1)
    })

    if (!blob) return file

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-ocr.png`, {
      type: 'image/png',
    })
  } catch {
    return file
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { language, toggleLanguage } = useLanguage()
  const text = {
    en: {
      loading: 'Loading profile...',
      back: 'Back',
      title: 'Profile',
      subtitle: 'Manage your basic profile and customer database',
      basicTitle: 'Basic Profile',
      basicDesc: 'Maintain your common information here.',
      email: 'Email',
      name: 'Name',
      company: 'Company',
      address: 'Address',
      phone: 'Phone',
      saving: 'Saving...',
      saveProfile: 'Save Basic Profile',
      databaseTitle: 'Profile Database',
      databaseDesc: 'Save common investor, company, address, and contact information here.',
      addCustomer: 'Add Customer Info',
      storedCustomers: 'Stored Customer Info',
      customerCount: 'Stored customer count',
      addCustomerTitle: 'Add Customer Info',
      uploadPhoto: 'Upload Customer ID Photo',
      choosePhoto: 'Choose Customer ID Photo',
      imageHint: 'Supports JPG, PNG, HEIC and other image formats',
      chooseFile: 'Choose File',
      photoPreview: 'Photo Preview',
      recognizing: 'Recognizing...',
      recognizePhoto: 'Recognize Photo Info',
      customerName: 'Customer Name',
      documentType: 'Document Type',
      documentNumber: 'Document Number',
      dateOfBirth: 'Date of Birth',
      expiryDate: 'Expiry Date',
      saveCustomer: 'Save Customer Info',
      noCustomers: 'No customer profiles yet',
      actions: 'Actions',
      unnamedCustomer: 'Unnamed Customer',
      viewDetails: 'View Details',
      delete: 'Delete',
      customerPhoto: 'Customer Photo',
      noPhoto: 'No photo',
      createdAt: 'Created At',
      saveProfileFailed: 'Failed to save profile: ',
      profileSaved: 'Profile saved successfully',
      choosePhotoFirst: 'Please choose a customer photo first',
      ocrFailed: 'OCR recognition failed',
      recognizeFailed: 'Recognition failed',
      userMissing: 'No user detected',
      uploadPhotoFirst: 'Please upload a customer photo first',
      photoUploadFailed: 'Photo upload failed: ',
      saveCustomerFailed: 'Failed to save customer info: ',
      customerSaved: 'Customer info saved',
      deletePhotoFailed: 'Failed to delete customer photo:',
      saveFailed: 'Save failed',
      deleteConfirm: 'Delete this customer profile?',
      deleted: 'Deleted successfully',
      deleteFailed: 'Delete failed',
    },
    zh: {
      loading: '正在加载资料...',
      back: '返回上一页',
      title: '个人资料',
      subtitle: '管理你的基础资料与客户资料库',
      basicTitle: '基本资料',
      basicDesc: '在这里维护你的常用信息。',
      email: '邮箱',
      name: '姓名',
      company: '公司',
      address: '地址',
      phone: '电话',
      saving: '保存中...',
      saveProfile: '保存基本资料',
      databaseTitle: '填写资料库',
      databaseDesc: '在这里保存投资人、公司、地址等常用资料。',
      addCustomer: '添加客户信息',
      storedCustomers: '已存储客户信息',
      customerCount: '当前已存储客户数量',
      addCustomerTitle: '添加客户信息',
      uploadPhoto: '上传客户证件照片',
      choosePhoto: '选择客户证件照片',
      imageHint: '支持 JPG、PNG、HEIC 等图片格式',
      chooseFile: '选择文件',
      photoPreview: '照片预览',
      recognizing: '识别中...',
      recognizePhoto: '识别照片信息',
      customerName: '客户姓名',
      documentType: '证件类型',
      documentNumber: '证件号码',
      dateOfBirth: '出生日期',
      expiryDate: '到期日',
      saveCustomer: '保存客户信息',
      noCustomers: '暂无客户资料',
      actions: '操作',
      unnamedCustomer: '未命名客户',
      viewDetails: '查看完整信息',
      delete: '删除',
      customerPhoto: '客户照片',
      noPhoto: '无照片',
      createdAt: '创建时间',
      saveProfileFailed: '保存资料失败：',
      profileSaved: '资料保存成功',
      choosePhotoFirst: '请先选择客户照片',
      ocrFailed: 'OCR 识别失败',
      recognizeFailed: '识别失败',
      userMissing: '未检测到用户',
      uploadPhotoFirst: '请先上传客户照片',
      photoUploadFailed: '照片上传失败：',
      saveCustomerFailed: '保存客户信息失败：',
      customerSaved: '客户信息已保存',
      deletePhotoFailed: '删除客户照片失败:',
      saveFailed: '保存失败',
      deleteConfirm: '确定要删除这条客户信息吗？',
      deleted: '删除成功',
      deleteFailed: '删除失败',
    },
  }[language]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showStoredCustomersModal, setShowStoredCustomersModal] = useState(false)
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false)

  const [customerPhotoFile, setCustomerPhotoFile] = useState<File | null>(null)
  const [customerPhotoPreview, setCustomerPhotoPreview] = useState('')
  const [recognizing, setRecognizing] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [documentType, setDocumentType] = useState('Australian Driver Licence')
  const [documentNumber, setDocumentNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [licenceClass, setLicenceClass] = useState('')
  const [conditions, setConditions] = useState('')
  const [issuingState, setIssuingState] = useState('')

  const [storedCustomers, setStoredCustomers] = useState<CustomerProfile[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null)

  const loadStoredCustomers = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setStoredCustomers(data)
    }
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
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
      setUserId(user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('name, company, address, phone')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setName(data.name ?? '')
        setCompany(data.company ?? '')
        setAddress(data.address ?? '')
        setPhone(data.phone ?? '')
      }

      await loadStoredCustomers(user.id)
      setLoading(false)
    }

    loadProfile()
  }, [language, loadStoredCustomers, router])

  const saveProfile = async () => {
    if (!userId) return

    setSaving(true)

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email,
      name,
      company,
      address,
      phone,
      updated_at: new Date().toISOString(),
    })

    setSaving(false)

    if (error) {
      alert(text.saveProfileFailed + error.message)
      return
    }

    alert(text.profileSaved)
  }

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCustomerPhotoFile(file)
    const previewUrl = URL.createObjectURL(file)
    setCustomerPhotoPreview(previewUrl)
  }

  const recognizeCustomerInfo = async () => {
    if (!customerPhotoFile) {
      alert(text.choosePhotoFirst)
      return
    }

    setRecognizing(true)

    try {
      const ocrFile = await upscaleImageForOcr(customerPhotoFile)
      const formData = new FormData()
      formData.append('file', ocrFile)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || text.ocrFailed)
      }

      setCustomerName(result.customer_name || '')
      setDocumentType(result.document_type || 'Australian Driver Licence')
      setDocumentNumber(result.document_number || '')
      setDateOfBirth(result.date_of_birth || '')
      setCustomerAddress(result.address || '')
      setExpiryDate(result.expiry_date || '')
      setCardNumber(result.card_number || '')
      setLicenceClass(result.licence_class || '')
      setConditions(result.conditions || '')
      setIssuingState(result.issuing_state || '')
    } catch (err: unknown) {
      alert(getErrorMessage(err, text.recognizeFailed))
    } finally {
      setRecognizing(false)
    }
  }

  const saveCustomerInfo = async () => {
    if (!userId) {
      alert(text.userMissing)
      return
    }

    if (!customerPhotoFile) {
      alert(text.uploadPhotoFirst)
      return
    }

    let uploadedPhotoPath = ''
    let uploadedPhotoUrl = ''

    try {
      const ext = customerPhotoFile.name.split('.').pop() || 'jpg'
      const fileName = `${userId}/${Date.now()}.${ext}`
      uploadedPhotoPath = fileName

      const { error: uploadError } = await supabase.storage
        .from('customer-photos')
        .upload(fileName, customerPhotoFile, {
          upsert: false,
        })

      if (uploadError) {
        throw new Error(text.photoUploadFailed + uploadError.message)
      }

      const { data: publicData } = supabase.storage
        .from('customer-photos')
        .getPublicUrl(fileName)

      uploadedPhotoUrl = publicData.publicUrl

      const customerPayload = {
        user_id: userId,
        customer_name: customerName,
        document_type: documentType,
        document_number: documentNumber,
        date_of_birth: dateOfBirth,
        address: customerAddress,
        expiry_date: expiryDate,
        photo_url: uploadedPhotoUrl,
        card_number: cardNumber,
        licence_class: licenceClass,
        conditions,
        issuing_state: issuingState,
      }

      let { error: insertError } = await supabase
        .from('customer_profiles')
        .insert(customerPayload)

      if (insertError && insertError.message.includes('issuing_state')) {
        const fallbackPayload = {
          user_id: userId,
          customer_name: customerName,
          document_type: documentType,
          document_number: documentNumber,
          date_of_birth: dateOfBirth,
          address: customerAddress,
          expiry_date: expiryDate,
          photo_url: uploadedPhotoUrl,
          card_number: cardNumber,
          licence_class: licenceClass,
          conditions,
        }

        const fallbackResult = await supabase
          .from('customer_profiles')
          .insert(fallbackPayload)

        insertError = fallbackResult.error
      }

      if (insertError) {
        if (uploadedPhotoPath) {
          await supabase.storage
            .from('customer-photos')
            .remove([uploadedPhotoPath])
        }

        throw new Error(text.saveCustomerFailed + insertError.message)
      }

      alert(text.customerSaved)
      resetCustomerModal()
      setShowAddCustomerModal(false)
      const photoPath = ''
      void getStoragePathFromPublicUrl(
        uploadedPhotoUrl || '',
        'customer-photos'
      )

      if (photoPath) {
        const { error: removeError } = await supabase.storage
          .from('customer-photos')
          .remove([photoPath])

        if (removeError) {
          console.warn(text.deletePhotoFailed, removeError.message)
        }
      }

      if (userId) {
        await loadStoredCustomers(userId)
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, text.saveFailed))
    }
  }

  const deleteCustomer = async (customerId: string) => {
    const confirmed = window.confirm(text.deleteConfirm)
    if (!confirmed) return

    try {
      const customer = storedCustomers.find((item) => item.id === customerId)

      const { error } = await supabase
        .from('customer_profiles')
        .delete()
        .eq('id', customerId)

      if (error) {
        throw new Error(error.message)
      }

      const photoPath = getStoragePathFromPublicUrl(
        customer?.photo_url || '',
        'customer-photos'
      )

      if (photoPath) {
        const { error: removeError } = await supabase.storage
          .from('customer-photos')
          .remove([photoPath])

        if (removeError) {
          console.warn(text.deletePhotoFailed, removeError.message)
        }
      }

      alert(text.deleted)
      if (userId) {
        await loadStoredCustomers(userId)
      }

      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(null)
        setShowCustomerDetailModal(false)
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, text.deleteFailed))
    }
  }

  const openCustomerDetail = (customer: CustomerProfile) => {
    setSelectedCustomer(customer)
    setShowCustomerDetailModal(true)
  }

  const resetCustomerModal = () => {
    setCustomerPhotoFile(null)
    setCustomerPhotoPreview('')
    setCustomerName('')
    setDocumentType('Australian Driver Licence')
    setDocumentNumber('')
    setDateOfBirth('')
    setCustomerAddress('')
    setExpiryDate('')
    setCardNumber('')
    setLicenceClass('')
    setConditions('')
    setIssuingState('')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        {text.loading}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] px-8 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <BackButton label={text.back} />
        </div>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[#111]">{text.title}</h1>
            <p className="mt-2 text-lg text-slate-500">{text.subtitle}</p>
          </div>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-[#111]">{text.basicTitle}</h2>
            <p className="mt-3 text-lg text-slate-500">{text.basicDesc}</p>

            <div className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.email}</label>
                <input
                  value={email ?? ''}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 text-base outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.name}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.company}</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.address}</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.phone}</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base outline-none"
                />
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="mt-8 w-full rounded-2xl bg-[#4a67f5] px-6 py-4 text-xl font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? text.saving : text.saveProfile}
            </button>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-[#111]">{text.databaseTitle}</h2>
            <p className="mt-3 text-lg text-slate-500">{text.databaseDesc}</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="rounded-2xl bg-[#1f2a44] px-8 py-5 text-2xl font-semibold text-white transition hover:opacity-90"
              >
                {text.addCustomer}
              </button>

              <button
                onClick={() => {
                  setShowStoredCustomersModal(true)
                  if (userId) {
                    loadStoredCustomers(userId)
                  }
                }}
                className="rounded-2xl border-2 border-[#1f2a44] bg-white px-8 py-5 text-2xl font-semibold text-[#1f2a44] transition hover:bg-slate-50"
              >
                {text.storedCustomers}
              </button>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-lg text-slate-600">{text.customerCount}</p>
              <p className="mt-3 text-5xl font-bold text-[#111]">{storedCustomers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {showAddCustomerModal && (
        <ModalShell
          title={text.addCustomerTitle}
          onClose={() => {
            resetCustomerModal()
            setShowAddCustomerModal(false)
          }}
          maxWidthClass="max-w-5xl"
        >
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                {text.uploadPhoto}
              </label>
              <label
                htmlFor="customer-photo-file"
                className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-4 transition hover:border-[#4a67f5] hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {customerPhotoFile ? customerPhotoFile.name : text.choosePhoto}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {text.imageHint}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-[#1f2a44] px-5 py-3 text-sm font-semibold text-white">
                  {text.chooseFile}
                </span>
              </label>
              <input
                id="customer-photo-file"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="sr-only"
              />
            </div>

            {customerPhotoPreview && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.photoPreview}</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={customerPhotoPreview}
                  alt={text.photoPreview}
                  className="max-h-72 rounded-2xl border border-slate-200"
                />
              </div>
            )}

            <button
              onClick={recognizeCustomerInfo}
              disabled={recognizing}
              className="rounded-2xl bg-[#4a67f5] px-6 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {recognizing ? text.recognizing : text.recognizePhoto}
            </button>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.customerName}</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.documentType}</label>
                <input
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.documentNumber}</label>
                <input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.dateOfBirth}</label>
                <input
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.address}</label>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.expiryDate}</label>
                <input
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Card Number</label>
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Licence Class</label>
                <input
                  value={licenceClass}
                  onChange={(e) => setLicenceClass(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Issuing State</label>
                <input
                  value={issuingState}
                  onChange={(e) => setIssuingState(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Conditions</label>
                <input
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4"
                />
              </div>
            </div>

            <button
              onClick={saveCustomerInfo}
              className="w-full rounded-2xl bg-[#8fbea5] px-6 py-4 text-xl font-semibold text-white transition hover:opacity-90"
            >
              {text.saveCustomer}
            </button>
          </div>
        </ModalShell>
      )}

      {showStoredCustomersModal && (
        <ModalShell
          title={text.storedCustomers}
          onClose={() => setShowStoredCustomersModal(false)}
          maxWidthClass="max-w-7xl"
        >
          {storedCustomers.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-lg text-slate-500">
              {text.noCustomers}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-6 py-4 text-sm font-semibold text-slate-700">
                <div className="col-span-3">{text.customerName}</div>
                <div className="col-span-3">{text.documentType}</div>
                <div className="col-span-2">{text.documentNumber}</div>
                <div className="col-span-2">{text.expiryDate}</div>
                <div className="col-span-2 text-right">{text.actions}</div>
              </div>

              <div className="divide-y divide-slate-200">
                {storedCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="grid grid-cols-12 items-center px-6 py-5 text-sm"
                  >
                    <div className="col-span-3 font-semibold text-slate-900">
                      {customer.customer_name || text.unnamedCustomer}
                    </div>

                    <div className="col-span-3 text-slate-600">
                      {customer.document_type || '-'}
                    </div>

                    <div className="col-span-2 text-slate-600">
                      {customer.document_number || '-'}
                    </div>

                    <div className="col-span-2 text-slate-600">
                      {customer.expiry_date || '-'}
                    </div>

                    <div className="col-span-2 flex justify-end gap-3">
                      <button
                        onClick={() => openCustomerDetail(customer)}
                        className="rounded-xl bg-[#4a67f5] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        {text.viewDetails}
                      </button>

                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        {text.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {showCustomerDetailModal && selectedCustomer && (
        <ModalShell
          title={text.storedCustomers}
          onClose={() => setShowCustomerDetailModal(false)}
          maxWidthClass="max-w-7xl"
          zClassName="z-[60]"
        >
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                {selectedCustomer.photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedCustomer.photo_url}
                    alt={selectedCustomer.customer_name || text.customerPhoto}
                    className="w-full rounded-3xl border border-slate-200 object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-[300px] items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-400">
                    {text.noPhoto}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-8">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.customerName}</label>
                  <input
                    readOnly
                    value={selectedCustomer.customer_name || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.documentType}</label>
                  <input
                    readOnly
                    value={selectedCustomer.document_type || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.documentNumber}</label>
                  <input
                    readOnly
                    value={selectedCustomer.document_number || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.dateOfBirth}</label>
                  <input
                    readOnly
                    value={selectedCustomer.date_of_birth || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.address}</label>
                  <input
                    readOnly
                    value={selectedCustomer.address || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.expiryDate}</label>
                  <input
                    readOnly
                    value={selectedCustomer.expiry_date || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Card Number</label>
                  <input
                    readOnly
                    value={selectedCustomer.card_number || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Licence Class</label>
                  <input
                    readOnly
                    value={selectedCustomer.licence_class || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Issuing State</label>
                  <input
                    readOnly
                    value={selectedCustomer.issuing_state || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Conditions</label>
                  <input
                    readOnly
                    value={selectedCustomer.conditions || ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{text.createdAt}</label>
                  <input
                    readOnly
                    value={
                      selectedCustomer.created_at
                        ? new Date(selectedCustomer.created_at).toLocaleString()
                        : ''
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  />
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
