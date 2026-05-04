'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/lib/supabase'
import BackButton from '@/src/components/BackButton'
import LanguageToggle from '@/src/components/LanguageToggle'
import { useLanguage } from '@/src/lib/use-language'
import { getCurrentAdminUser } from '@/src/lib/admin'

type UploadedFile = {
    name: string
    path: string
    created_at?: string | null
}

type GeneratedPdf = {
    id: string
    source_pdf_path: string
    generated_pdf_path: string
    file_name: string
    revision: number
    created_at: string
    updated_at: string
}

export default function DashboardPage() {
    const router = useRouter()
    const { language, toggleLanguage } = useLanguage()
    const [email, setEmail] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState('')
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState('')

    const [files, setFiles] = useState<UploadedFile[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [deletingPath, setDeletingPath] = useState<string | null>(null)
    const [generatedPdfs, setGeneratedPdfs] = useState<GeneratedPdf[]>([])
    const [loadingGenerated, setLoadingGenerated] = useState(false)
    const [deletingGeneratedId, setDeletingGeneratedId] = useState<string | null>(null)
    const text = {
        en: {
            loadFailed: 'Failed to read file list: ',
            choosePdfFirst: 'Please select a PDF file first',
            uploadFailed: 'Upload failed: ',
            uploaded: 'PDF uploaded to cloud',
            deleteConfirm: 'Delete this file?',
            deleteFailed: 'Delete failed: ',
            deleted: 'File deleted',
            loading: 'Loading workspace...',
            back: 'Back',
            title: 'Form Workspace',
            account: 'Current account: ',
            uploadTitle: 'Upload PDF Form',
            uploadDesc: 'Upload the PDF form you want to fill automatically.',
            chooseFile: 'Choose PDF File',
            selected: 'Selected: ',
            noFile: 'No file selected',
            uploading: 'Uploading...',
            uploadButton: 'Upload to Cloud',
            profileTitle: 'Profile Database',
            profileDesc: 'Save common investor, company, address, and contact information here.',
            enterProfile: 'Open Profile Database',
            uploadedFiles: 'Uploaded Files',
            readingFiles: 'Reading file list...',
            noFiles: 'No PDF files have been uploaded yet.',
            open: 'Open',
            deleting: 'Deleting...',
            delete: 'Delete',
        },
        zh: {
            loadFailed: '读取文件列表失败：',
            choosePdfFirst: '请先选择一个 PDF 文件',
            uploadFailed: '上传失败：',
            uploaded: 'PDF 已成功上传到云端',
            deleteConfirm: '确定删除这个文件吗？',
            deleteFailed: '删除失败：',
            deleted: '文件已删除',
            loading: '正在加载工作台...',
            back: '返回上一页',
            title: '表单工作台',
            account: '当前登录账号：',
            uploadTitle: '上传 PDF 表单',
            uploadDesc: '在这里上传需要自动填写的 PDF 表单。',
            chooseFile: '选择 PDF 文件',
            selected: '已选择：',
            noFile: '尚未选择文件',
            uploading: '上传中...',
            uploadButton: '上传到云端',
            profileTitle: '填写资料库',
            profileDesc: '在这里保存投资人、公司、地址等常用资料。',
            enterProfile: '进入资料库',
            uploadedFiles: '已上传文件',
            readingFiles: '正在读取文件列表...',
            noFiles: '还没有上传任何 PDF 文件。',
            open: '打开',
            deleting: '删除中...',
            delete: '删除',
        },
    }[language]

    const generatedText = {
        title: language === 'zh' ? '已生成 PDF 文件' : 'Generated PDF Files',
        loading: language === 'zh' ? '正在读取已生成 PDF...' : 'Reading generated PDFs...',
        empty: language === 'zh' ? '暂无已生成 PDF。' : 'No generated PDFs yet.',
        view: language === 'zh' ? '查看 PDF' : 'View PDF',
        edit: language === 'zh' ? '修改' : 'Edit',
        viewFailed: language === 'zh' ? '打开 PDF 失败：' : 'Failed to open PDF: ',
    }

    const loadFiles = useCallback(async (uid: string) => {
        setLoadingFiles(true)

        const { data, error } = await supabase.storage
            .from('pdf-forms')
            .list(uid, {
                limit: 100,
                sortBy: { column: 'name', order: 'desc' },
            })

        if (error) {
            setMessage(text.loadFailed + error.message)
        } else {
            const mapped = (data || []).map((item) => ({
                name: item.name,
                path: `${uid}/${item.name}`,
                created_at: item.created_at,
            }))
            setFiles(mapped)
        }

        setLoadingFiles(false)
    }, [text.loadFailed])

    const loadGeneratedPdfs = useCallback(async (uid: string) => {
        setLoadingGenerated(true)

        const { data, error } = await supabase
            .from('generated_pdfs')
            .select('id, source_pdf_path, generated_pdf_path, file_name, revision, created_at, updated_at')
            .eq('user_id', uid)
            .order('updated_at', { ascending: false })

        if (error) {
            setMessage(text.loadFailed + error.message)
        } else {
            setGeneratedPdfs(data || [])
        }

        setLoadingGenerated(false)
    }, [text.loadFailed])

    useEffect(() => {
        const checkUser = async () => {
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
            setLoading(false)
            loadFiles(user.id)
            loadGeneratedPdfs(user.id)
        }

        checkUser()
    }, [language, loadFiles, loadGeneratedPdfs, router])

    const handleUpload = async () => {
        if (!selectedFile || !userId) {
            setMessage(text.choosePdfFirst)
            return
        }

        setUploading(true)
        setMessage('')

        const safeName = selectedFile.name
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_.-]/g, '')
            .replace(/_+/g, '_')

        const filePath = `${userId}/${Date.now()}_${safeName}`

        const { error } = await supabase.storage
            .from('pdf-forms')
            .upload(filePath, selectedFile)

        if (error) {
            setMessage(text.uploadFailed + error.message)
        } else {
            setMessage(text.uploaded)
            setSelectedFile(null)
            setFileName('')
            loadFiles(userId)
        }

        setUploading(false)
    }

    const handleDelete = async (file: UploadedFile) => {
        if (!userId) return

        const confirmed = window.confirm(`${text.deleteConfirm}\n\n${file.name}`)
        if (!confirmed) return

        setDeletingPath(file.path)
        setMessage('')

        const { error } = await supabase.storage
            .from('pdf-forms')
            .remove([file.path])

        if (error) {
            setMessage(text.deleteFailed + error.message)
        } else {
            setMessage(text.deleted)
            loadFiles(userId)
        }

        setDeletingPath(null)
    }

    const handleViewGenerated = async (file: GeneratedPdf) => {
        const { data, error } = await supabase.storage
            .from('generated-pdfs')
            .createSignedUrl(file.generated_pdf_path, 60 * 10)

        if (error || !data?.signedUrl) {
            setMessage(generatedText.viewFailed + (error?.message || 'Unknown error'))
            return
        }

        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }

    const handleDeleteGenerated = async (file: GeneratedPdf) => {
        if (!userId) return

        const confirmed = window.confirm(`${text.deleteConfirm}\n\n${file.file_name}`)
        if (!confirmed) return

        setDeletingGeneratedId(file.id)
        setMessage('')

        const { error: storageError } = await supabase.storage
            .from('generated-pdfs')
            .remove([file.generated_pdf_path])

        const { error: dbError } = await supabase
            .from('generated_pdfs')
            .delete()
            .eq('id', file.id)

        if (storageError || dbError) {
            setMessage(text.deleteFailed + (storageError?.message || dbError?.message || 'Unknown error'))
        } else {
            setMessage(text.deleted)
            loadGeneratedPdfs(userId)
        }

        setDeletingGeneratedId(null)
    }

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-lg text-gray-600">{text.loading}</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gray-100 p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6">
                    <BackButton
                        label={language === 'zh' ? '退出登录' : 'Log Out'}
                        onClick={async () => {
                            await supabase.auth.signOut()
                            router.push('/login')
                        }}
                    />
                </div>


                <div className="flex flex-col bg-white rounded-3xl shadow-lg p-8">
                    <div className="mb-3 flex items-start justify-between gap-4">
                        <h1 className="text-4xl font-bold">{text.title}</h1>
                        <LanguageToggle language={language} onToggle={toggleLanguage} />
                    </div>
                    <p className="text-gray-600 mb-8">{text.account}{email}</p>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-gray-200 p-7 shadow-sm">
                            <h2 className="text-2xl font-semibold mb-3">{text.uploadTitle}</h2>
                            <p className="text-gray-600 mb-6 leading-7">
                                {text.uploadDesc}
                            </p>

                            <div className="space-y-4">
                                <label className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-700 cursor-pointer transition">
                                    {text.chooseFile}
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                setSelectedFile(file)
                                                setFileName(file.name)
                                                setMessage('')
                                            }
                                        }}
                                        className="hidden"
                                    />
                                </label>

                                <div className="min-h-[52px] rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                                    {fileName ? (
                                        <p className="text-sm text-gray-700 break-all">
                                            {text.selected}{fileName}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-400">{text.noFile}</p>
                                    )}
                                </div>

                                <button
                                    onClick={handleUpload}
                                    disabled={uploading || !selectedFile}
                                    className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {uploading ? text.uploading : text.uploadButton}
                                </button>

                                {message && (
                                    <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                                        {message}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 p-7 shadow-sm">
                            <h2 className="text-2xl font-semibold mb-3">{text.profileTitle}</h2>
                            <p className="text-gray-600 mb-6 leading-7">
                                {text.profileDesc}
                            </p>

                            <Link
                                href="/profile"
                                className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-5 py-3 text-white font-medium hover:bg-slate-900 transition"
                            >
                                {text.enterProfile}
                            </Link>
                        </div>

                        <div className="rounded-2xl border border-gray-200 p-7 shadow-sm">
                            <h2 className="text-2xl font-semibold mb-3">
                                {language === 'zh' ? '管理员邮箱' : 'Administrator Emails'}
                            </h2>
                            <p className="text-gray-600 mb-6 leading-7">
                                {language === 'zh'
                                    ? '管理可以登录本系统的管理员邮箱。'
                                    : 'Manage who can log in to this system.'}
                            </p>

                            <Link
                                href="/admin"
                                className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-5 py-3 text-white font-medium hover:bg-slate-900 transition"
                            >
                                {language === 'zh' ? '管理管理员' : 'Manage Administrators'}
                            </Link>
                        </div>
                    </div>

                    <div className="order-2 mt-8 rounded-2xl border border-gray-200 p-7 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4">{generatedText.title}</h2>

                        {loadingGenerated ? (
                            <p className="text-gray-500">{generatedText.loading}</p>
                        ) : generatedPdfs.length === 0 ? (
                            <p className="text-gray-500">{generatedText.empty}</p>
                        ) : (
                            <div className="space-y-3">
                                {generatedPdfs.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 break-all">
                                                {file.file_name}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                v{file.revision} · {new Date(file.updated_at).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="ml-4 flex shrink-0 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleViewGenerated(file)}
                                                className="rounded-lg bg-slate-800 px-4 py-2 text-white text-sm hover:bg-slate-900"
                                            >
                                                {generatedText.view}
                                            </button>

                                            <Link
                                                href={`/fill?path=${encodeURIComponent(file.source_pdf_path)}&generatedId=${encodeURIComponent(file.id)}`}
                                                className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700"
                                            >
                                                {generatedText.edit}
                                            </Link>

                                            <button
                                                type="button"
                                                className="rounded-lg bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                                                disabled={deletingGeneratedId === file.id}
                                                onClick={() => handleDeleteGenerated(file)}
                                            >
                                                {deletingGeneratedId === file.id ? text.deleting : text.delete}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="order-1 mt-8 rounded-2xl border border-gray-200 p-7 shadow-sm">
                        <h2 className="text-2xl font-semibold mb-4">{text.uploadedFiles}</h2>

                        {loadingFiles ? (
                            <p className="text-gray-500">{text.readingFiles}</p>
                        ) : files.length === 0 ? (
                            <p className="text-gray-500">{text.noFiles}</p>
                        ) : (
                            <div className="space-y-3">
                                {files.map((file) => (
                                    <div
                                        key={file.path}
                                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                                    >
                                        <p className="text-sm text-gray-800 break-all">
                                            {file.name}
                                        </p>

                                        <div className="ml-4 flex shrink-0 gap-2">
                                            <Link
                                                href={`/fill?path=${encodeURIComponent(file.path)}`}
                                                className="ml-4 rounded-lg bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700"
                                            >
                                                {text.open}
                                            </Link>

                                            <button
                                                className="rounded-lg bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                                                disabled={deletingPath === file.path}
                                                onClick={() => handleDelete(file)}
                                            >
                                                {deletingPath === file.path ? text.deleting : text.delete}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
