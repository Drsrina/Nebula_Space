import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import { FSFileNode } from '../../types';
import { useFSStore } from '../../store/useFSStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useEditorStore } from '../../store/useEditorStore';
import { formatBytes } from '../../lib/fs';

function getFileIcon(ext?: string) {
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'json':
    case 'html':
    case 'css':
      return <FileCode className="w-4 h-4 text-[#3ba9ff] shrink-0" />;
    case 'md':
    case 'txt':
    case 'rtf':
      return <FileText className="w-4 h-4 text-[#5eead4] shrink-0" />;
    case 'csv':
    case 'tsv':
      return <FileSpreadsheet className="w-4 h-4 text-[#6ea8ff] shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'webp':
      return <FileImage className="w-4 h-4 text-[#93c5fd] shrink-0" />;
    default:
      return <FileIcon className="w-4 h-4 text-[#7a92b8] shrink-0" />;
  }
}

interface TreeNodeProps {
  node: FSFileNode;
  level: number;
  selectedPath?: string;
  onSelectFile: (node: FSFileNode) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, selectedPath, onSelectFile }) => {
  const [isOpen, setIsOpen] = useState<boolean>(level === 0 || level === 1);
  const isSelected = selectedPath === node.path;

  if (node.kind === 'directory') {
    return (
      <div className="select-none">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${Math.max(8, level * 14)}px` }}
          className="w-full flex items-center gap-1.5 py-1 px-2 text-xs font-medium text-[#e6f0ff]/90 hover:bg-[#3ba9ff]/10 hover:text-white rounded-md transition-colors text-left group"
        >
          <span className="text-[#7a92b8] group-hover:text-[#3ba9ff] transition-colors">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-[#3ba9ff] shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-[#6ea8ff] shrink-0" />
          )}
          <span className="truncate font-mono">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-[10px] text-[#7a92b8] opacity-60">
              {node.children.length}
            </span>
          )}
        </button>

        {isOpen && node.children && node.children.length > 0 && (
          <div className="border-l border-[#3ba9ff]/10 ml-3.5">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node)}
      style={{ paddingLeft: `${Math.max(12, level * 14 + 14)}px` }}
      className={`w-full flex items-center gap-2 py-1 px-2 text-xs rounded-md transition-all text-left ${
        isSelected
          ? 'bg-[#3ba9ff]/20 text-[#5eead4] font-medium border border-[#5eead4]/30 shadow-[0_0_12px_rgba(94,234,212,0.2)]'
          : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/10'
      }`}
    >
      {getFileIcon(node.extension)}
      <span className="truncate font-mono flex-1">{node.name}</span>
      {node.size !== undefined && node.size > 0 && (
        <span className="text-[10px] text-[#7a92b8]/70 font-mono shrink-0">
          {formatBytes(node.size)}
        </span>
      )}
    </button>
  );
};

export const FileTreeWindow: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string>('README.md');

  const { rootNodes, directoryName, isLoading, getFileContent, openDirectoryPicker } = useFSStore();
  const { openFilePreview } = useWindowsStore();

  const handleSelectFile = async (node: FSFileNode) => {
    setSelectedPath(node.path);
    const { content, isBinary, size } = await getFileContent(node);

    if (!isBinary) {
      useEditorStore.getState().openFileInEditor({
        path: node.path,
        name: node.name,
        content,
        handle: node.handle as FileSystemFileHandle,
      });
    }

    openFilePreview({
      filePath: node.path,
      fileName: node.name,
      fileExtension: node.extension,
      content,
      isBinary,
      size,
      lastModified: node.lastModified,
    });
  };

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return rootNodes;
    const q = search.toLowerCase();

    function filterNode(node: FSFileNode): FSFileNode | null {
      if (node.name.toLowerCase().includes(q)) {
        return node;
      }
      if (node.kind === 'directory' && node.children) {
        const matchingKids = node.children
          .map(filterNode)
          .filter((n): n is FSFileNode => n !== null);
        if (matchingKids.length > 0) {
          return { ...node, children: matchingKids };
        }
      }
      return null;
    }

    return rootNodes
      .map(filterNode)
      .filter((n): n is FSFileNode => n !== null);
  }, [rootNodes, search]);

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/70 text-[#e6f0ff]">
      {/* Search and action bar */}
      <div className="p-3 border-b border-[#3ba9ff]/15 flex flex-col gap-2 bg-[#0a1628]/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a92b8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar arquivos..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#050810]/70 border border-[#3ba9ff]/20 rounded-lg text-xs text-[#e6f0ff] placeholder-[#7a92b8]/60 focus:outline-none focus:border-[#3ba9ff] focus:ring-1 focus:ring-[#3ba9ff]/40 transition-all font-mono"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#7a92b8] px-0.5">
          <span className="truncate max-w-[180px] font-mono" title={directoryName}>
            {directoryName}
          </span>
          <button
            type="button"
            onClick={() => openDirectoryPicker()}
            className="flex items-center gap-1 hover:text-[#5eead4] transition-colors"
            title="Trocar pasta local"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Mudar</span>
          </button>
        </div>
      </div>

      {/* Directory tree list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#7a92b8]">
            <RefreshCw className="w-5 h-5 animate-spin text-[#3ba9ff]" />
            <span className="text-xs">Indexando diretório...</span>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-[#7a92b8]">
            Nenhum arquivo encontrado para "{search}".
          </div>
        ) : (
          filteredNodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
            />
          ))
        )}
      </div>

      {/* Bottom hint */}
      <div className="py-2 px-3 bg-[#050810]/60 border-t border-[#3ba9ff]/10 text-[11px] text-[#7a92b8] flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4] inline-block animate-pulse" />
          Degrau 1 (Contexto)
        </span>
        <span className="text-[10px] opacity-75 font-mono">Clique para abrir no Degrau 0</span>
      </div>
    </div>
  );
};
