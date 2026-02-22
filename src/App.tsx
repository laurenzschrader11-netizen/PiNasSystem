/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  File, 
  Trash2, 
  Download, 
  HardDrive, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Search,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Moon,
  Sun,
  Edit3,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import bytes from 'bytes';

interface NASFile {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  upload_date: string;
  folder_id: string | null;
}

interface NASFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

interface Stats {
  count: number;
  totalSize: number;
}

export default function App() {
  const [files, setFiles] = useState<NASFile[]>([]);
  const [folders, setFolders] = useState<NASFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<NASFolder[]>([]);
  const [stats, setStats] = useState<Stats>({ count: 0, totalSize: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  
  const [renameItem, setRenameItem] = useState<{ id: string, name: string, type: 'file' | 'folder' } | null>(null);
  const [newName, setNewName] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchContents = async (folderId: string) => {
    try {
      const response = await fetch(`/api/contents?folderId=${folderId}`);
      const data = await response.json();
      setFiles(data.files);
      setFolders(data.folders);
    } catch (error) {
      console.error('Error fetching contents:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const statsData = await response.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchContents(currentFolderId), fetchStats()]);
      setLoading(false);
    };
    init();
    
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [currentFolderId]);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', currentFolderId);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        await Promise.all([fetchContents(currentFolderId), fetchStats()]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName, parentId: currentFolderId }),
      });
      if (response.ok) {
        setNewFolderName('');
        setShowNewFolderModal(false);
        await fetchContents(currentFolderId);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleRename = async () => {
    if (!renameItem || !newName.trim()) return;
    try {
      const response = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renameItem.id, type: renameItem.type, newName }),
      });
      if (response.ok) {
        setRenameItem(null);
        setNewName('');
        await fetchContents(currentFolderId);
      }
    } catch (error) {
      console.error('Rename failed:', error);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      const response = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await Promise.all([fetchContents(currentFolderId), fetchStats()]);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;
    
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await Promise.all([fetchContents(currentFolderId), fetchStats()]);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDownload = (id: string) => {
    window.location.href = `/api/files/${id}/download`;
  };

  const navigateToFolder = (folder: NASFolder | 'root') => {
    if (folder === 'root') {
      setCurrentFolderId('root');
      setFolderPath([]);
    } else {
      setCurrentFolderId(folder.id);
      const index = folderPath.findIndex(f => f.id === folder.id);
      if (index !== -1) {
        setFolderPath(folderPath.slice(0, index + 1));
      } else {
        setFolderPath([...folderPath, folder]);
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => {
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const getFileIcon = (file: NASFile) => {
    if (file.mime_type.startsWith('image/')) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <img 
            src={`/api/files/${file.id}/view`} 
            alt="" 
            className="w-full h-full object-cover"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(`/api/files/${file.id}/view`);
            }}
          />
        </div>
      );
    }
    if (file.mime_type.startsWith('video/')) return <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Video className="w-5 h-5 text-blue-500" /></div>;
    if (file.mime_type.startsWith('audio/')) return <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg"><Music className="w-5 h-5 text-purple-500" /></div>;
    if (file.mime_type.includes('pdf') || file.mime_type.includes('text')) return <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg"><FileText className="w-5 h-5 text-orange-500" /></div>;
    return <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><File className="w-5 h-5 text-slate-400" /></div>;
  };

  const filteredFiles = files.filter(file => 
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900'} font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/40`}>
      {/* Sidebar / Header */}
      <header className={`sticky top-0 z-10 border-b backdrop-blur-md px-6 py-4 ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PiNAS</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Local Storage System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search files..."
                className={`pl-10 pr-4 py-2 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-full transition-all active:scale-95 ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setShowNewFolderModal(true)}
                className={`p-2 rounded-full transition-all active:scale-95 ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="New Folder"
              >
                <FolderPlus className="w-5 h-5" />
              </button>
              <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-95">
                <Plus className="w-4 h-4" />
                <span>Upload</span>
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-6 text-sm font-medium overflow-x-auto whitespace-nowrap pb-2">
          <button 
            onClick={() => navigateToFolder('root')}
            className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${currentFolderId === 'root' ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Root</span>
          </button>
          {folderPath.map((folder, idx) => (
            <React.Fragment key={folder.id}>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 flex-shrink-0" />
              <button 
                onClick={() => navigateToFolder(folder)}
                className={`hover:text-indigo-600 transition-colors ${idx === folderPath.length - 1 ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <File className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Files</span>
            </div>
            <div className="text-3xl font-bold">{stats.count}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Stored on your Pi</div>
          </div>

          <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                <HardDrive className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Used Space</span>
            </div>
            <div className="text-3xl font-bold">{bytes(stats.totalSize)}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Total storage utilized</div>
          </div>
        </div>

        {/* Upload Area */}
        <div 
          className={`mb-8 border-2 border-dashed rounded-2xl p-12 transition-all flex flex-col items-center justify-center gap-4 ${
            dragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">Uploading your file...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                <Upload className="w-8 h-8" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Drag and drop files here</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">or click the upload button to browse</p>
              </div>
            </>
          )}
        </div>

        {/* Contents List */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Contents</h2>
            <span className="text-xs font-medium text-slate-500">{filteredFolders.length + filteredFiles.length} items</span>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          ) : (filteredFolders.length === 0 && filteredFiles.length === 0) ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <File className="w-6 h-6" />
              </div>
              <p className="text-slate-500 font-medium">This folder is empty</p>
              <p className="text-sm text-slate-400">Start by uploading something or creating a folder!</p>
            </div>
          ) : (
            <div className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              <AnimatePresence mode="popLayout">
                {/* Folders */}
                {filteredFolders.map((folder) => (
                  <motion.div 
                    key={folder.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`group px-6 py-4 flex items-center justify-between transition-colors cursor-pointer ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                    onClick={() => navigateToFolder(folder)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                        <Folder className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">
                          {folder.name}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>Folder</span>
                          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                          <span>{dayjs(folder.created_at).format('MMM D, YYYY')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRenameItem({ id: folder.id, name: folder.name, type: 'folder' }); setNewName(folder.name); }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-all"
                        title="Rename"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                        title="Delete Folder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {/* Files */}
                {filteredFiles.map((file) => (
                  <motion.div 
                    key={file.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`group px-6 py-4 flex items-center justify-between transition-colors ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {getFileIcon(file)}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4" title={file.original_name}>
                          {file.original_name}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>{bytes(file.size)}</span>
                          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                          <span>{dayjs(file.upload_date).format('MMM D, YYYY • HH:mm')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDownload(file.id)}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setRenameItem({ id: file.id, name: file.original_name, type: 'file' }); setNewName(file.original_name); }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-all"
                        title="Rename"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="font-bold text-lg">New Folder</h3>
                <button onClick={() => setShowNewFolderModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Folder Name</label>
                <input 
                  autoFocus
                  type="text" 
                  className={`w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  placeholder="Enter folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
              </div>
              <div className={`px-6 py-4 flex items-center justify-end gap-3 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <button 
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateFolder}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                >
                  Create Folder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="font-bold text-lg">Rename {renameItem.type === 'file' ? 'File' : 'Folder'}</h3>
                <button onClick={() => setRenameItem(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">New Name</label>
                <input 
                  autoFocus
                  type="text" 
                  className={`w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                />
              </div>
              <div className={`px-6 py-4 flex items-center justify-end gap-3 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <button 
                  onClick={() => setRenameItem(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRename}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                >
                  Rename
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 text-center">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
          PiNAS v1.2 • Pro Edition • Built for Raspberry Pi
        </p>
      </footer>
    </div>
  );
}
