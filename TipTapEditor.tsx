'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react';
import * as TiptapReact from '@tiptap/react';
import { Node as TipTapNode, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TextAlign from '@tiptap/extension-text-align';
import { common, createLowlight } from 'lowlight';

import { 
  Bold, 
  Italic, 
  Strikethrough,
  Underline as UnderlineIcon,
  Code,
  Highlighter,
  Palette,
  List, 
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2, 
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Link as LinkIcon, 
  Image as ImageIcon,
  GripVertical,
  Trash2,
  Type,
  Quote,
  Video,
  Images,
  Columns,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Maximize2,
  Minimize2,
  MousePointer2,
  MoveVertical,
  Minus,
  Globe,
  Grid,
  BoxSelect,
  LayoutTemplate,
  Lock,
  Search,
  Menu,
  Table as TableIcon,
  FileText,
  AlertCircle
} from 'lucide-react';

// Initialize Patterns
initPatterns();

const lowlight = createLowlight(common);

// Workaround for missing type exports in strict environments
const BubbleMenu = (TiptapReact as any).BubbleMenu || (() => null);
const FloatingMenu = (TiptapReact as any).FloatingMenu || (() => null);

interface TipTapEditorProps {
  initialContent?: string | object;
  onChange?: (json: object) => void;
  onEditorReady?: (editor: any) => void;
  onSelectionUpdate?: (editor: any) => void;
  className?: string;
  name?: string;
  viewMode?: 'visual' | 'code';
}

// --- Standard Extensions ---

const GlobalStyleExtension = Extension.create({
  name: 'globalStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'image', 'bulletList', 'orderedList', 'blockquote', 'ctaButton', 'testimonial', 'navigation'],
        attributes: {
          textColor: {
            default: null,
            parseHTML: element => element.style.color?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.textColor) return {};
              return { style: `color: ${attributes.textColor}` };
            },
          },
          backgroundColor: {
            default: null,
            parseHTML: element => element.style.backgroundColor?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.backgroundColor) return {};
              return { style: `background-color: ${attributes.backgroundColor}` };
            },
          },
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
          paddingTop: { default: null, renderHTML: attrs => attrs.paddingTop ? { style: `padding-top: ${attrs.paddingTop}` } : {} },
          paddingBottom: { default: null, renderHTML: attrs => attrs.paddingBottom ? { style: `padding-bottom: ${attrs.paddingBottom}` } : {} },
          marginTop: { default: null, renderHTML: attrs => attrs.marginTop ? { style: `margin-top: ${attrs.marginTop}` } : {} },
          marginBottom: { default: null, renderHTML: attrs => attrs.marginBottom ? { style: `margin-bottom: ${attrs.marginBottom}` } : {} },
          locked: {
            default: false,
            parseHTML: element => element.getAttribute('data-locked') === 'true',
            renderHTML: attributes => {
              if (!attributes.locked) return {};
              return { 'data-locked': 'true', class: 'locked-block relative' };
            },
          }
        },
      },
    ];
  },
});

const VideoNode = TipTapNode.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'video-wrapper' }, ['iframe', mergeAttributes(HTMLAttributes, { frameborder: 0, allowfullscreen: 'true' })]];
  },
});

const GalleryNode = TipTapNode.create({
  name: 'gallery',
  group: 'block',
  content: 'image+',
  parseHTML() {
    return [{ tag: 'div', getAttrs: (element: HTMLElement) => element.classList.contains('gallery') && null }];
  },
  renderHTML() {
    return ['div', { class: 'gallery' }, 0];
  },
});

const TwoColumnNode = TipTapNode.create({
  name: 'twoColumn',
  group: 'block',
  content: 'block+', 
  parseHTML() { return [{ tag: 'div', getAttrs: (element: HTMLElement) => element.classList.contains('two-column') && null }]; },
  renderHTML() { return ['div', { class: 'two-column' }, 0]; },
});

const ThreeColumnNode = TipTapNode.create({
  name: 'threeColumn',
  group: 'block',
  content: 'block+', 
  parseHTML() { return [{ tag: 'div', getAttrs: (element: HTMLElement) => element.classList.contains('three-column') && null }]; },
  renderHTML() { return ['div', { class: 'three-column' }, 0]; },
});

const ButtonNode = TipTapNode.create({
  name: 'ctaButton',
  group: 'block',
  content: 'text*',
  atom: true,
  addAttributes() {
    return {
      url: { default: '#' },
      label: { default: 'Click Me' },
      variant: { default: 'primary' },
      target: { default: '_self' }
    }
  },
  parseHTML() {
    return [{ tag: 'a', getAttrs: (element: HTMLElement) => element.classList.contains('cta-button') && null }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { class: `cta-button variant-${HTMLAttributes.variant}` }), HTMLAttributes.label];
  }
});

const SpacerNode = TipTapNode.create({
  name: 'spacer',
  group: 'block',
  atom: true,
  addAttributes() {
    return { height: { default: '32px' } }
  },
  parseHTML() { return [{ tag: 'div', getAttrs: (element: HTMLElement) => element.classList.contains('spacer') && null }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'spacer', style: `height: ${HTMLAttributes.height}` }];
  }
});

const ThemeBlockNode = TipTapNode.create({
  name: 'themeBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { type: { default: 'site-title' } }
  },
  parseHTML() { return [{ tag: 'div', getAttrs: (element: HTMLElement) => element.classList.contains('theme-block') && null }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: `theme-block type-${HTMLAttributes.type}`, 'data-type': HTMLAttributes.type }, `[${HTMLAttributes.type.replace('-', ' ').toUpperCase()}]`];
  }
});

const QueryLoopNode = TipTapNode.create({
  name: 'queryLoop',
  group: 'block',
  atom: true,
  addAttributes() {
    return { limit: { default: 3 } }
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'query-loop' }, `[QUERY LOOP: RECENT POSTS (${HTMLAttributes.limit})]`];
  }
});

const CalloutNode = TipTapNode.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      type: { default: 'info' },
      emoji: { default: '💡' }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: `callout callout-${HTMLAttributes.type}` }), 
      ['span', { class: 'callout-emoji', contenteditable: 'false' }, HTMLAttributes.emoji],
      ['div', { class: 'callout-content' }, 0]
    ];
  }
});

const FileAttachmentNode = TipTapNode.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      href: { default: '#' },
      fileName: { default: 'File' },
      fileSize: { default: '' }
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-type="file-attachment"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-type': 'file-attachment', class: 'file-attachment', target: '_blank', contenteditable: 'false' }),
      ['span', { class: 'file-icon' }, '📄'],
      ['div', { class: 'file-info' },
        ['span', { class: 'file-name' }, HTMLAttributes.fileName],
        HTMLAttributes.fileSize ? ['span', { class: 'file-size' }, HTMLAttributes.fileSize] : ''
      ]
    ];
  }
});

const CustomImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        renderHTML: (attributes) => ({ style: `width: ${attributes.width}` }),
      },
      align: {
        default: 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.align,
          style: `display: block; margin-left: ${attributes.align === 'center' ? 'auto' : '0'}; margin-right: ${attributes.align === 'center' || attributes.align === 'right' ? 'auto' : '0'};`,
        }),
      },
      title: { default: null },
      alt: { default: null },
    };
  },
});

export default function TipTapEditor({ 
  initialContent, 
  onChange, 
  onEditorReady,
  onSelectionUpdate,
  className,
  name,
  viewMode = 'visual'
}: TipTapEditorProps) {
  const [jsonContent, setJsonContent] = useState('');
  const [activeBlockRect, setActiveBlockRect] = useState<DOMRect | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [codeContent, setCodeContent] = useState(''); 
  const editorRef = useRef<HTMLDivElement>(null);

  // Merge built-in extensions with Registered Custom Extensions
  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      link: false,
      underline: false,
    }),
    Underline,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    GlobalStyleExtension,
    CustomImage,
    VideoNode,
    GalleryNode,
    TwoColumnNode,
    ThreeColumnNode,
    ButtonNode,
    SpacerNode,
    ThemeBlockNode,
    QueryLoopNode,
    CalloutNode,
    FileAttachmentNode,
    LinkExtension.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-blue-600 hover:underline' },
    }),
    Placeholder.configure({ placeholder: 'Type \'/\' for commands...' }),
  ];

  const editor = useEditor({
    extensions,
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: `prose prose-lg max-w-none focus:outline-none min-h-[50vh] ${className || ''} relative pl-2`,
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      if (name) setJsonContent(JSON.stringify(json));
      if (onChange) onChange(json);
      updateActiveBlockPosition(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionUpdate) onSelectionUpdate(editor);
      updateActiveBlockPosition(editor);
    },
    onCreate: ({ editor }) => {
        if (name) setJsonContent(JSON.stringify(editor.getJSON()));
        if (onEditorReady) onEditorReady(editor);
    }
  });

  const updateActiveBlockPosition = (editor: Editor) => {
    if (!editor.isFocused) return;
    requestAnimationFrame(() => {
        try {
            const { from } = editor.state.selection;
            const domPos = editor.view.domAtPos(from);
            let node = domPos.node as HTMLElement;
            const editorContent = editorRef.current?.querySelector('.ProseMirror');
            if (!editorContent || !node) return;
            if (node.nodeType === 3 && node.parentElement) node = node.parentElement;
            while (node && node.parentElement !== editorContent && node.parentElement) node = node.parentElement;
            if (node && node.getBoundingClientRect) setActiveBlockRect(node.getBoundingClientRect());
        } catch (e) {}
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        setShowBlockMenu(false);
      }
    };
    const handleScroll = () => {
      const dragHandle = document.querySelector('.custom-drag-handle');
      if (dragHandle) {
        dragHandle.classList.add('hide');
      }
      setShowBlockMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Sync HTML when switching modes
  useEffect(() => {
    if (!editor) return;
    if (viewMode === 'code') {
      setCodeContent(editor.getHTML());
    } else {
      // Switching back to visual, hydrate from code if changed
      if (codeContent) {
        editor.commands.setContent(codeContent);
      }
    }
  }, [viewMode, editor]);

  // --- Actions ---
  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      (editor.chain().focus() as any).extendMarkRange('link').unsetLink().run();
      return;
    }
    (editor.chain().focus() as any).extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const checkLocked = () => {
    if (!editor) return false;
    return editor.isActive({ locked: true }); 
  };

  const activeLocked = checkLocked();

  return (
    <div className="relative w-full group" ref={editorRef}>
      {name && <input type="hidden" name={name} value={jsonContent} />}
      
      {/* Code Editor Mode */}
      {viewMode === 'code' && (
        <textarea 
          value={codeContent}
          onChange={(e) => {
            setCodeContent(e.target.value);
            if (editor) editor.commands.setContent(e.target.value, { emitUpdate: false }); 
          }}
          className="w-full h-[60vh] font-mono text-sm p-4 bg-gray-900 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          spellCheck={false}
        />
      )}

      {/* Visual Editor Mode */}
      <div className={viewMode === 'code' ? 'hidden' : 'block'}>
        {/* Side Handle (Managed by GlobalDragHandle) */}
        <div 
            className="custom-drag-handle fixed z-50 flex items-center transition-opacity duration-150"
        >
            <div className="relative">
                <button
                    className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing transition-colors"
                    onClick={() => setShowBlockMenu(!showBlockMenu)}
                    type="button"
                >
                    {activeLocked ? <Lock className="w-4 h-4 text-red-400" /> : <GripVertical className="w-4 h-4" />}
                </button>
                <div className={`absolute left-full ml-2 top-0 bg-white border border-gray-200 shadow-xl rounded-lg p-1 w-48 z-50 flex flex-col gap-1 animate-fade-in-up ${showBlockMenu ? 'block' : 'hidden'}`}>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Turn Into</div>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleHeading({ level: 1 }).run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Heading1 className="w-4 h-4 text-gray-400" /> Heading 1
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleHeading({ level: 2 }).run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Heading2 className="w-4 h-4 text-gray-400" /> Heading 2
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleHeading({ level: 3 }).run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Heading3 className="w-4 h-4 text-gray-400" /> Heading 3
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).setParagraph().run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Type className="w-4 h-4 text-gray-400" /> Text
                    </button>
                    <div className="w-full h-px bg-gray-100 my-1"></div>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleBulletList().run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <List className="w-4 h-4 text-gray-400" /> Bullet List
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleOrderedList().run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <ListOrdered className="w-4 h-4 text-gray-400" /> Numbered List
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleTaskList().run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <CheckSquare className="w-4 h-4 text-gray-400" /> Task List
                    </button>
                    <div className="w-full h-px bg-gray-100 my-1"></div>
                    <button onClick={() => { (editor?.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <TableIcon className="w-4 h-4 text-gray-400" /> Table
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).toggleCodeBlock().run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Code className="w-4 h-4 text-gray-400" /> Code Block
                    </button>
                    <button onClick={() => { (editor?.chain().focus() as any).insertContent({ type: 'callout', attrs: { type: 'info', emoji: '💡' } }).run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <AlertCircle className="w-4 h-4 text-gray-400" /> Callout
                    </button>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">Media (Upload)</div>
                    <button onClick={() => { 
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const dataUrl = event.target?.result as string;
                                    (editor?.chain().focus() as any).setImage({ src: dataUrl }).run();
                                };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                        setShowBlockMenu(false); 
                    }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <ImageIcon className="w-4 h-4 text-gray-400" /> Image
                    </button>
                    <button onClick={() => { 
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'video/*';
                        input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const dataUrl = event.target?.result as string;
                                    (editor?.chain().focus() as any).insertContent({ type: 'video', attrs: { src: dataUrl } }).run();
                                };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                        setShowBlockMenu(false); 
                    }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Video className="w-4 h-4 text-gray-400" /> Video
                    </button>
                    <button onClick={() => { 
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const dataUrl = event.target?.result as string;
                                    const size = file.size < 1024 * 1024 
                                        ? (file.size / 1024).toFixed(1) + ' KB' 
                                        : (file.size / 1024 / 1024).toFixed(2) + ' MB';
                                    (editor?.chain().focus() as any).insertContent({ type: 'fileAttachment', attrs: { href: dataUrl, fileName: file.name, fileSize: size } }).run();
                                };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                        setShowBlockMenu(false); 
                    }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <FileText className="w-4 h-4 text-gray-400" /> File
                    </button>

                    <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">Media (URL)</div>
                    <button onClick={() => { 
                        const url = window.prompt('Image URL');
                        if (url) { 
                            (editor?.chain().focus() as any).setImage({ src: url }).run(); 
                        }
                        setShowBlockMenu(false); 
                    }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <ImageIcon className="w-4 h-4 text-gray-400" /> Image
                    </button>
                    <button onClick={() => { 
                        const url = window.prompt('Video Embed URL');
                        if (url) { 
                            (editor?.chain().focus() as any).insertContent({ type: 'video', attrs: { src: url } }).run(); 
                        }
                        setShowBlockMenu(false); 
                    }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <Video className="w-4 h-4 text-gray-400" /> Video
                    </button>
                    <button onClick={() => { 
                        const url = window.prompt('File URL');
                        if (url) {
                            const name = window.prompt('File Name', 'Document');
                            if (name) {
                                (editor?.chain().focus() as any).insertContent({ type: 'fileAttachment', attrs: { href: url, fileName: name, fileSize: 'Unknown' } }).run();
                            }
                        }
                        setShowBlockMenu(false); 
                    }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-sm text-gray-700 text-left">
                        <FileText className="w-4 h-4 text-gray-400" /> File
                    </button>
                    <div className="w-full h-px bg-gray-100 my-1"></div>
                    {!activeLocked ? (
                      <button onClick={() => { (editor?.chain().focus() as any).deleteSelection().run(); setShowBlockMenu(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-red-50 text-red-600 rounded text-sm text-left">
                          <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-gray-400 italic flex items-center gap-2 border-t border-gray-100 mt-1">
                        <Lock className="w-3 h-3" /> Block Locked
                      </div>
                    )}
                </div>
            </div>
        </div>

        {/* Bubble Menu for Images & Formatting */}
        {editor && (
          <BubbleMenu 
            editor={editor} 
            tippyOptions={{ duration: 100 }} 
            shouldShow={({ editor }: { editor: any }) => editor.isActive('image') || (!editor.state.selection.empty && !editor.isActive('image') && !editor.isActive('table'))}
            className="flex items-center gap-1 bg-white shadow-xl border border-gray-200 rounded-lg p-1 overflow-hidden"
          >
            {editor.isActive('image') ? (
              <>
                <button onClick={() => (editor.chain().focus() as any).setImage({ align: 'left' }).run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Left"><AlignLeft className="w-4 h-4" /></button>
                <button onClick={() => (editor.chain().focus() as any).setImage({ align: 'center' }).run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Center"><AlignCenter className="w-4 h-4" /></button>
                <button onClick={() => (editor.chain().focus() as any).setImage({ align: 'right' }).run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Right"><AlignRight className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button onClick={() => (editor.chain().focus() as any).setImage({ width: '50%' }).run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Half Width"><Minimize2 className="w-4 h-4" /></button>
                <button onClick={() => (editor.chain().focus() as any).setImage({ width: '100%' }).run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Full Width"><Maximize2 className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Bold"><Bold className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Italic"><Italic className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Underline"><UnderlineIcon className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().toggleCode().run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Inline Code"><Code className="w-4 h-4" /></button>
                <button onClick={setLink} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('link') ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`} title="Link"><LinkIcon className="w-4 h-4" /></button>
                
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                
                <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Align Left"><AlignLeft className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Align Center"><AlignCenter className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Align Right"><AlignRight className="w-4 h-4" /></button>
                <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-100 text-black' : 'text-gray-600'}`} title="Justify"><AlignJustify className="w-4 h-4" /></button>

                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                
                <div className="relative group/color flex items-center">
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Text Color"><Palette className="w-4 h-4" /></button>
                  <input 
                    type="color" 
                    onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()} 
                    value={editor.getAttributes('textStyle').color || '#000000'} 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Text Color"
                  />
                </div>
                
                <div className="relative group/highlight flex items-center">
                  <button className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('highlight') ? 'bg-yellow-100 text-yellow-600' : 'text-gray-600'}`} title="Highlight Color"><Highlighter className="w-4 h-4" /></button>
                  <input 
                    type="color" 
                    onInput={event => editor.chain().focus().toggleHighlight({ color: (event.target as HTMLInputElement).value }).run()} 
                    value={editor.getAttributes('highlight').color || '#ffff00'} 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Highlight Color"
                  />
                </div>
              </>
            )}
          </BubbleMenu>
        )}

        {/* Table Controls Bubble Menu */}
        {editor && (
          <BubbleMenu 
            editor={editor} 
            tippyOptions={{ duration: 100, placement: 'top' }} 
            shouldShow={({ editor }: { editor: any }) => editor.isActive('table')}
            className="flex items-center gap-1 bg-white shadow-xl border border-gray-200 rounded-lg p-1 overflow-hidden"
          >
            <button onClick={() => (editor.chain().focus() as any).addColumnBefore().run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 text-xs font-medium" title="Add Column Before">+Col L</button>
            <button onClick={() => (editor.chain().focus() as any).addColumnAfter().run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 text-xs font-medium" title="Add Column After">+Col R</button>
            <button onClick={() => (editor.chain().focus() as any).deleteColumn().run()} className="p-1.5 rounded hover:bg-red-50 text-red-600 text-xs font-medium" title="Delete Column">-Col</button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button onClick={() => (editor.chain().focus() as any).addRowBefore().run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 text-xs font-medium" title="Add Row Before">+Row U</button>
            <button onClick={() => (editor.chain().focus() as any).addRowAfter().run()} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 text-xs font-medium" title="Add Row After">+Row D</button>
            <button onClick={() => (editor.chain().focus() as any).deleteRow().run()} className="p-1.5 rounded hover:bg-red-50 text-red-600 text-xs font-medium" title="Delete Row">-Row</button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button onClick={() => (editor.chain().focus() as any).deleteTable().run()} className="p-1.5 rounded hover:bg-red-50 text-red-600 text-xs font-medium" title="Delete Table">Delete Table</button>
          </BubbleMenu>
        )}

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
