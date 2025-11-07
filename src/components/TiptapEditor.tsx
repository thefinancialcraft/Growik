import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Extension } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeViewWrapper } from '@tiptap/react';
import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import Suggestion from '@tiptap/suggestion';

// Custom Font Size Extension
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).updateAttributes('textStyle', { fontSize: null }).run();
        },
    };
  },
});
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Code,
  Link2, Image as ImageIcon, Undo, Redo,
  Heading1, Heading2, Heading3, Type, CheckSquare, ChevronDown
} from 'lucide-react';
import { useCallback } from 'react';

// Slash Command Menu Items
interface CommandItem {
  title: string;
  description: string;
  icon: any;
  command: (editor: Editor) => void;
}

const slashCommands: CommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bold',
    description: 'Make text bold',
    icon: Bold,
    command: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    title: 'Italic',
    description: 'Make text italic',
    icon: Italic,
    command: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    title: 'Underline',
    description: 'Underline text',
    icon: UnderlineIcon,
    command: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    title: 'Strikethrough',
    description: 'Strike through text',
    icon: Strikethrough,
    command: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a bullet list',
    icon: List,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: ListOrdered,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Insert a quote',
    icon: Quote,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Insert a code block',
    icon: Code,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

type ListType = 'bullet' | 'ordered' | null;

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const GOOGLE_TEXT_COLORS: string[][] = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff'],
  ['#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3'],
  ['#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599'],
  ['#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd', '#cc0000', '#e69138'],
  ['#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#674ea7', '#a64d79', '#85200c', '#b45f06'],
  ['#bf9000', '#38761d', '#134f5c', '#1155cc', '#351c75', '#741b47', '#5b0f00', '#783f04'],
  ['#7f6000', '#274e13', '#0c343d', '#073763', '#20124d', '#4c1130', '#000000', '#ffffff'],
];

const GOOGLE_HIGHLIGHT_COLORS: string[][] = [
  ['#ffffff', '#f28b82', '#fbbc04', '#fff475', '#ccff90', '#a7ffeb', '#cbf0f8', '#aecbfa'],
  ['#d7aefb', '#fdcfe8', '#e6c9a8', '#e8eaed', '#fddede', '#fdecc8', '#fff8b3', '#dcf4d7'],
  ['#c4f4e0', '#d7f0fa', '#d3e3fd', '#eaddff', '#fce8f6', '#f9dedc', '#fce8b2', '#fef7cd'],
];

type BlockTypeName = 'paragraph' | 'heading' | 'blockquote' | 'codeBlock';

interface SavedFormatting {
  blockType: {
    name: BlockTypeName;
    attrs?: {
      level?: HeadingLevel;
    };
  };
  listType: ListType;
  marks: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    color: string | null;
    highlight: string | null;
    fontFamily: string | null;
    fontSize: string | null;
  };
  textAlign: string | null;
}

interface SlashCommandMenuProps {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
}

interface SlashCommandMenuHandle {
  setSelectedIndex: (index: number) => void;
  getSelectedIndex: () => number;
  selectCurrentItem: () => void;
  reset: () => void;
  getItemsCount: () => number;
  getSelectedItem: () => CommandItem;
}

const SlashCommandMenu = React.forwardRef<SlashCommandMenuHandle, SlashCommandMenuProps>(({ items, onSelect }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(items.length > 0 ? items.length - 1 : 0);
    }
  }, [items.length, selectedIndex]);

  useEffect(() => {
    const active = itemRefs.current[selectedIndex];
    const container = containerRef.current;
    if (active && container) {
      const { top: containerTop, bottom: containerBottom } = container.getBoundingClientRect();
      const { top: itemTop, bottom: itemBottom } = active.getBoundingClientRect();

      if (itemTop < containerTop) {
        container.scrollTop -= containerTop - itemTop + 8;
      } else if (itemBottom > containerBottom) {
        container.scrollTop += itemBottom - containerBottom + 8;
      }
    }
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    setSelectedIndex: (index: number) => {
      if (!items.length) return;
      const bounded = ((index % items.length) + items.length) % items.length;
      setSelectedIndex(bounded);
    },
    getSelectedIndex: () => selectedIndex,
    selectCurrentItem: () => {
      const item = items[selectedIndex];
      if (item) {
        onSelect(item);
      }
    },
    reset: () => {
      setSelectedIndex(0);
    },
    getItemsCount: () => items.length,
    getSelectedItem: () => items[selectedIndex],
  }), [items, selectedIndex, onSelect]);

  if (!items.length) {
    return (
      <div ref={containerRef} className="slash-command-menu bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-h-80 overflow-y-auto">
        <div className="px-3 py-2 text-sm text-gray-500">No results</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="slash-command-menu bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-h-80 overflow-y-auto">
      {items.map((item: CommandItem, index: number) => {
        const Icon = item.icon;
        const isActive = index === selectedIndex;
        return (
          <button
            key={index}
            ref={(el) => (itemRefs.current[index] = el)}
            type="button"
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => onSelect(item)}
            className={`w-full text-left px-3 py-2 rounded-md flex items-start gap-3 transition-colors ${
              isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100 border border-transparent'
            }`}
          >
            <Icon size={18} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>{item.title}</div>
              <div className={`text-xs ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

// Slash Command Extension with proper suggestion configuration
const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

// Resizable Image Component
const ResizableImageComponent = ({ node, updateAttributes, selected }: any) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use node.attrs directly to always get the latest saved dimensions
  const currentWidth = node.attrs.width ? parseInt(node.attrs.width) : 300;
  const currentHeight = node.attrs.height ? parseInt(node.attrs.height) : 200;
  
  const [dimensions, setDimensions] = useState({ 
    width: currentWidth, 
    height: currentHeight 
  });

  // Sync dimensions with node attributes - always use saved dimensions
  useEffect(() => {
    if (node.attrs.width && node.attrs.height) {
      const savedWidth = parseInt(node.attrs.width);
      const savedHeight = parseInt(node.attrs.height);
      
      setDimensions({ 
        width: savedWidth, 
        height: savedHeight 
      });
    }
  }, [node.attrs.width, node.attrs.height, node.attrs.src]);

  // Initialize dimensions on first load
  useEffect(() => {
    const img = imgRef.current;
    if (!img || isInitialized || node.attrs.width) return;

    const handleImageLoad = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      // Limit initial size to max 600px width
      let width = naturalWidth;
      let height = naturalHeight;
      
      if (width > 600) {
        const ratio = 600 / width;
        width = 600;
        height = Math.round(height * ratio);
      }
      
      setDimensions({ width, height });
      updateAttributes({ width, height });
      setIsInitialized(true);
    };

    if (img.complete) {
      handleImageLoad();
    } else {
      img.addEventListener('load', handleImageLoad);
      return () => img.removeEventListener('load', handleImageLoad);
    }
  }, [node.attrs.src, isInitialized, node.attrs.width]);

  const handleMouseDown = (e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;
      
      let newWidth = startPos.current.width;
      let newHeight = startPos.current.height;

      // Check if it's a corner handle (maintains aspect ratio)
      const isCorner = corner.length === 2;
      
      if (corner.includes('e')) {
        newWidth = Math.max(50, startPos.current.width + deltaX);
      } else if (corner.includes('w')) {
        newWidth = Math.max(50, startPos.current.width - deltaX);
      }

      if (corner.includes('s')) {
        newHeight = Math.max(50, startPos.current.height + deltaY);
      } else if (corner.includes('n')) {
        newHeight = Math.max(50, startPos.current.height - deltaY);
      }

      // Maintain aspect ratio ONLY for corner handles
      if (isCorner) {
        const aspectRatio = startPos.current.width / startPos.current.height;
        if (corner.includes('e') || corner.includes('w')) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      }

      setDimensions({ width: Math.round(newWidth), height: Math.round(newHeight) });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      updateAttributes({ width: dimensions.width, height: dimensions.height });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper 
      ref={wrapperRef}
      className="resizable-image-wrapper" 
      style={{ 
        display: 'inline-block', 
        position: 'relative',
        cursor: selected ? 'grab' : 'default',
      }}
      as="div"
      data-drag-handle
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        width={isResizing ? dimensions.width : (node.attrs.width || dimensions.width)}
        height={isResizing ? dimensions.height : (node.attrs.height || dimensions.height)}
        style={{
          width: `${isResizing ? dimensions.width : (node.attrs.width || dimensions.width)}px`,
          height: `${isResizing ? dimensions.height : (node.attrs.height || dimensions.height)}px`,
          maxWidth: '100%',
          cursor: isResizing ? 'nwse-resize' : 'inherit',
          pointerEvents: isResizing ? 'none' : 'auto',
          transition: isResizing ? 'none' : 'all 0.2s ease',
        }}
        className={selected ? 'selected-image' : ''}
        data-drag-handle
      />
      {selected && (
        <>
          {/* Corner Handles */}
          <div
            className="resize-handle resize-handle-nw"
            onMouseDown={(e) => handleMouseDown(e, 'nw')}
            style={{
              position: 'absolute',
              top: '-5px',
              left: '-5px',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'nw-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-handle-ne"
            onMouseDown={(e) => handleMouseDown(e, 'ne')}
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'ne-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-handle-sw"
            onMouseDown={(e) => handleMouseDown(e, 'sw')}
            style={{
              position: 'absolute',
              bottom: '-5px',
              left: '-5px',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'sw-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-handle-se"
            onMouseDown={(e) => handleMouseDown(e, 'se')}
            style={{
              position: 'absolute',
              bottom: '-5px',
              right: '-5px',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'se-resize',
              zIndex: 10,
            }}
          />
          
          {/* Side Handles */}
          <div
            className="resize-handle resize-handle-n"
            onMouseDown={(e) => handleMouseDown(e, 'n')}
            style={{
              position: 'absolute',
              top: '-5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'n-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-handle-s"
            onMouseDown={(e) => handleMouseDown(e, 's')}
            style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 's-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-handle-w"
            onMouseDown={(e) => handleMouseDown(e, 'w')}
            style={{
              position: 'absolute',
              top: '50%',
              left: '-5px',
              transform: 'translateY(-50%)',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'w-resize',
              zIndex: 10,
            }}
          />
          <div
            className="resize-handle resize-handle-e"
            onMouseDown={(e) => handleMouseDown(e, 'e')}
            style={{
              position: 'absolute',
              top: '50%',
              right: '-5px',
              transform: 'translateY(-50%)',
              width: '10px',
              height: '10px',
              background: '#8b5cf6',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'e-resize',
              zIndex: 10,
            }}
          />
        </>
      )}
    </NodeViewWrapper>
  );
};

// Custom Resizable Image Extension
const ResizableImage = Image.extend({
  name: 'image',
  
  draggable: true,
  
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes.width) {
            return {};
          }
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => {
          if (!attributes.height) {
            return {};
          }
          return { height: attributes.height };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onVariableClick?: () => void;
  onEditorReady?: (editor: Editor) => void;
}

const MenuBar = ({ editor, onVariableClick }: { editor: Editor | null; onVariableClick?: () => void }) => {
  if (!editor) {
    return null;
  }

  const styleMenuRef = useRef<HTMLDivElement | null>(null);
  const textColorMenuRef = useRef<HTMLDivElement | null>(null);
  const highlightColorMenuRef = useRef<HTMLDivElement | null>(null);
  const textColorButtonRef = useRef<HTMLButtonElement | null>(null);
  const highlightColorButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isTextColorMenuOpen, setIsTextColorMenuOpen] = useState(false);
  const [isHighlightColorMenuOpen, setIsHighlightColorMenuOpen] = useState(false);
  const [textColorMenuPosition, setTextColorMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [highlightColorMenuPosition, setHighlightColorMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isTextCustomMode, setIsTextCustomMode] = useState(false);
  const [textCustomColor, setTextCustomColor] = useState('#000000');
  const [isHighlightCustomMode, setIsHighlightCustomMode] = useState(false);
  const [highlightCustomColor, setHighlightCustomColor] = useState('#ffff00');
  const [copiedFormatting, setCopiedFormatting] = useState<SavedFormatting | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState(false);
  const formatPainterDataRef = useRef<SavedFormatting | null>(null);
  const formatPainterActiveRef = useRef(false);
  const formatPainterSourceRef = useRef<{ from: number; to: number } | null>(null);
  const formatPainterLastAppliedRef = useRef<{ from: number; to: number } | null>(null);

  const closeTextColorMenu = useCallback(() => {
    setIsTextColorMenuOpen(false);
    setTextColorMenuPosition(null);
    setIsTextCustomMode(false);
  }, []);

  const closeHighlightColorMenu = useCallback(() => {
    setIsHighlightColorMenuOpen(false);
    setHighlightColorMenuPosition(null);
    setIsHighlightCustomMode(false);
  }, []);

  const updateTextColorMenuPosition = useCallback(() => {
    const button = textColorButtonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    setTextColorMenuPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    });
  }, []);

  const updateHighlightColorMenuPosition = useCallback(() => {
    const button = highlightColorButtonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    setHighlightColorMenuPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    });
  }, []);

  useEffect(() => {
    formatPainterDataRef.current = copiedFormatting;
    formatPainterActiveRef.current = isFormatPainterActive && !!copiedFormatting;
  }, [copiedFormatting, isFormatPainterActive]);

  useEffect(() => {
    if (!isTextColorMenuOpen && !isHighlightColorMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (isTextColorMenuOpen) {
        const menu = textColorMenuRef.current;
        const button = textColorButtonRef.current;
        if (
          menu &&
          (menu.contains(target) || (button && button.contains(target)))
        ) {
          // Click inside menu or on button should not close
        } else {
          closeTextColorMenu();
        }
      }

      if (isHighlightColorMenuOpen) {
        const menu = highlightColorMenuRef.current;
        const button = highlightColorButtonRef.current;
        if (
          menu &&
          (menu.contains(target) || (button && button.contains(target)))
        ) {
          // Click inside menu or on button should not close
        } else {
          closeHighlightColorMenu();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isTextColorMenuOpen,
    isHighlightColorMenuOpen,
    closeTextColorMenu,
    closeHighlightColorMenu,
  ]);

  useEffect(() => {
    if (!isTextColorMenuOpen) {
      return;
    }

    const handleUpdate = () => {
      updateTextColorMenuPosition();
    };

    handleUpdate();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isTextColorMenuOpen, updateTextColorMenuPosition]);

  useEffect(() => {
    if (!isHighlightColorMenuOpen) {
      return;
    }

    const handleUpdate = () => {
      updateHighlightColorMenuPosition();
    };

    handleUpdate();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isHighlightColorMenuOpen, updateHighlightColorMenuPosition]);

  useEffect(() => {
    if (!isStyleMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (styleMenuRef.current && !styleMenuRef.current.contains(event.target as Node)) {
        setIsStyleMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStyleMenuOpen]);

  const normalizeColorValue = useCallback((value: string | null | undefined): string | null => {
    if (!value) {
      return null;
    }

    const trimmed = value.trim().toLowerCase();
    if (trimmed.startsWith('rgb')) {
      const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (match) {
        const r = Number(match[1]).toString(16).padStart(2, '0');
        const g = Number(match[2]).toString(16).padStart(2, '0');
        const b = Number(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    if (trimmed.startsWith('#')) {
      return trimmed;
    }

    return `#${trimmed}`;
  }, []);

  const currentTextColor = normalizeColorValue(editor.getAttributes('textStyle').color);
  const currentHighlightColor = normalizeColorValue(editor.getAttributes('highlight').color);

  const renderColorGrid = useCallback(
    (
      palette: string[][],
      selectedColor: string | null,
      onSelect: (color: string) => void
    ) => {
      const normalizedSelected = selectedColor ? selectedColor.toLowerCase() : null;

      return (
        <div className="space-y-1">
          {palette.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((color) => {
                const normalizedColor = color.toLowerCase();
                const isSelected = normalizedColor === normalizedSelected;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onSelect(color)}
                    className={`w-6 h-6 rounded-sm border transition-all duration-150 ${
                      isSelected
                        ? 'border-blue-500 shadow-[0_0_0_2px_rgba(37,99,235,0.35)]'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    },
    []
  );

  const captureCurrentFormatting = useCallback((): SavedFormatting | null => {
    if (!editor) {
      return null;
    }

    const blockType: SavedFormatting['blockType'] = (() => {
      if (editor.isActive('heading', { level: 1 })) {
        return { name: 'heading', attrs: { level: 1 } };
      }
      if (editor.isActive('heading', { level: 2 })) {
        return { name: 'heading', attrs: { level: 2 } };
      }
      if (editor.isActive('heading', { level: 3 })) {
        return { name: 'heading', attrs: { level: 3 } };
      }
      if (editor.isActive('codeBlock')) {
        return { name: 'codeBlock' };
      }
      if (editor.isActive('blockquote')) {
        return { name: 'blockquote' };
      }
      return { name: 'paragraph' };
    })();

    const listType: ListType =
      editor.isActive('bulletList') ? 'bullet' : editor.isActive('orderedList') ? 'ordered' : null;

    const textStyleAttrs = editor.getAttributes('textStyle') ?? {};
    const highlightAttrs = editor.getAttributes('highlight') ?? {};
    const headingAttrs = editor.getAttributes('heading') ?? {};
    const paragraphAttrs = editor.getAttributes('paragraph') ?? {};
    const rawAlign =
      (headingAttrs.textAlign as string | undefined) ??
      (paragraphAttrs.textAlign as string | undefined) ??
      null;
    const textAlign = rawAlign && rawAlign !== 'left' ? rawAlign : null;

    const marks = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      color: (textStyleAttrs.color as string | undefined) ?? null,
      highlight: (highlightAttrs.color as string | undefined) ?? null,
      fontFamily: (textStyleAttrs.fontFamily as string | undefined) ?? null,
      fontSize: (textStyleAttrs.fontSize as string | undefined) ?? null,
    };

    return {
      blockType,
      listType,
      marks,
      textAlign,
    };
  }, [editor]);

  const disableFormatPainter = useCallback(() => {
    setIsFormatPainterActive(false);
    setCopiedFormatting(null);
    formatPainterDataRef.current = null;
    formatPainterActiveRef.current = false;
    formatPainterSourceRef.current = null;
    formatPainterLastAppliedRef.current = null;
  }, []);

  const applySavedFormatting = useCallback(() => {
    if (!editor) {
      return;
    }

    const formatting = formatPainterDataRef.current;
    if (!formatting) {
      return;
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      return;
    }

    const lastAppliedRange = formatPainterLastAppliedRef.current;
    if (lastAppliedRange && lastAppliedRange.from === from && lastAppliedRange.to === to) {
      return;
    }

    const sourceRange = formatPainterSourceRef.current;
    if (sourceRange && sourceRange.from === from && sourceRange.to === to) {
      return;
    }

    const { $from, $to } = editor.state.selection;
    const sameParent = $from.sameParent($to);
    const selectionIsWholeTextBlock =
      sameParent &&
      $from.parent.isTextblock &&
      from === $from.start($from.depth) &&
      to === $from.end($from.depth);

    let chain = editor.chain().focus();

    const castWithOptional = (cmd: typeof chain) =>
      cmd as typeof cmd & {
        unsetTextAlign?: () => typeof chain;
        unsetAllMarks?: () => typeof chain;
        unsetColor?: () => typeof chain;
        unsetHighlight?: () => typeof chain;
        unsetFontFamily?: () => typeof chain;
        unsetFontSize?: () => typeof chain;
      };

    if (selectionIsWholeTextBlock) {
    chain = chain.clearNodes();

    switch (formatting.blockType.name) {
      case 'heading':
          {
            const level: HeadingLevel = formatting.blockType.attrs?.level ?? 1;
            chain = chain.setHeading({ level });
          }
        break;
      case 'blockquote':
        chain = chain.toggleBlockquote();
        break;
      case 'codeBlock':
        chain = chain.toggleCodeBlock();
        break;
      default:
        chain = chain.setParagraph();
        break;
    }

    if (formatting.listType === 'bullet') {
      chain = chain.toggleBulletList();
    } else if (formatting.listType === 'ordered') {
      chain = chain.toggleOrderedList();
    }

      const chainWithOptional = castWithOptional(chain);
    if (chainWithOptional.unsetTextAlign) {
      chain = chainWithOptional.unsetTextAlign();
    }

    if (formatting.textAlign) {
      chain = chain.setTextAlign(formatting.textAlign);
      }
    }

    let chainWithOptional = castWithOptional(chain);

    if (chainWithOptional.unsetAllMarks) {
      chain = chainWithOptional.unsetAllMarks();
      chainWithOptional = castWithOptional(chain);
    }

    if (chainWithOptional.unsetColor) {
      chain = chainWithOptional.unsetColor();
      chainWithOptional = castWithOptional(chain);
    }
    if (formatting.marks.color) {
      chain = chain.setColor(formatting.marks.color);
      chainWithOptional = castWithOptional(chain);
    }

    if (chainWithOptional.unsetHighlight) {
      chain = chainWithOptional.unsetHighlight();
      chainWithOptional = castWithOptional(chain);
    }
    if (formatting.marks.highlight) {
      chain = chain.setHighlight({ color: formatting.marks.highlight });
      chainWithOptional = castWithOptional(chain);
    }

    if (chainWithOptional.unsetFontFamily) {
      chain = chainWithOptional.unsetFontFamily();
      chainWithOptional = castWithOptional(chain);
    }
    if (formatting.marks.fontFamily) {
      chain = chain.setFontFamily(formatting.marks.fontFamily);
      chainWithOptional = castWithOptional(chain);
    }

    if (chainWithOptional.unsetFontSize) {
      chain = chainWithOptional.unsetFontSize();
      chainWithOptional = castWithOptional(chain);
    }
    if (formatting.marks.fontSize) {
      chain = chain.setFontSize(formatting.marks.fontSize);
    }

    if (formatting.marks.bold) {
      chain = chain.toggleBold();
    }
    if (formatting.marks.italic) {
      chain = chain.toggleItalic();
    }
    if (formatting.marks.underline) {
      chain = chain.toggleUnderline();
    }
    if (formatting.marks.strike) {
      chain = chain.toggleStrike();
    }

    chain.run();
    formatPainterLastAppliedRef.current = { from, to };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;

      if (!formatPainterActiveRef.current) {
        return;
      }

      if (from === to) {
        return;
      }

      applySavedFormatting();
    };

    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, applySavedFormatting]);

  const handleStyleFormatterClick = useCallback(() => {
    if (!editor) {
      return;
    }

    if (isFormatPainterActive) {
      disableFormatPainter();
      return;
    }

    const { from, to } = editor.state.selection;

    if (from === to) {
      disableFormatPainter();
      return;
    }

    const formatting = captureCurrentFormatting();
    if (!formatting) {
      disableFormatPainter();
      return;
    }

    setCopiedFormatting(formatting);
    setIsFormatPainterActive(true);
    formatPainterDataRef.current = formatting;
    formatPainterActiveRef.current = true;
    formatPainterSourceRef.current = { from, to };
    formatPainterLastAppliedRef.current = null;
    setIsStyleMenuOpen(false);
  }, [editor, captureCurrentFormatting, isFormatPainterActive, disableFormatPainter]);

  const styleOptions = [
    {
      label: 'Normal text',
      active: editor.isActive('paragraph') && !editor.isActive('heading'),
      action: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: 'Heading 1',
      active: editor.isActive('heading', { level: 1 }),
      action: () => editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      active: editor.isActive('heading', { level: 2 }),
      action: () => editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      active: editor.isActive('heading', { level: 3 }),
      action: () => editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      label: 'Quote',
      active: editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Code block',
      active: editor.isActive('codeBlock'),
      action: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];

  const linkButtonRef = useRef<HTMLButtonElement | null>(null);
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkPopoverPosition, setLinkPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [linkFormType, setLinkFormType] = useState<'email' | 'phone' | 'sms' | 'url'>('url');
  const [linkFormText, setLinkFormText] = useState('');
  const [linkFormTarget, setLinkFormTarget] = useState('');

  const closeLinkPopover = useCallback(() => {
    setIsLinkPopoverOpen(false);
    setLinkPopoverPosition(null);
    setLinkFormType('url');
    setLinkFormText('');
    setLinkFormTarget('');
  }, []);

  const inferLinkType = useCallback((href: string | undefined): { type: 'email' | 'phone' | 'sms' | 'url'; target: string } => {
    if (!href) {
      return { type: 'url', target: '' };
    }

    if (href.startsWith('mailto:')) {
      return { type: 'email', target: href.replace(/^mailto:/, '') };
    }
    if (href.startsWith('tel:')) {
      return { type: 'phone', target: href.replace(/^tel:/, '') };
    }
    if (href.startsWith('sms:')) {
      return { type: 'sms', target: href.replace(/^sms:/, '') };
    }
    return { type: 'url', target: href };
  }, []);

  const openLinkPopover = useCallback(() => {
    if (!editor) {
      return;
    }

    const { from, to } = editor.state.selection;
    const coords = editor.view.coordsAtPos(to);
    setLinkPopoverPosition({
      top: coords.bottom + window.scrollY + 6,
      left: coords.left + window.scrollX,
    });

    const existingHref = editor.getAttributes('link').href as string | undefined;
    const { type, target } = inferLinkType(existingHref);
    setLinkFormType(type);
    setLinkFormTarget(target);

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    setLinkFormText(selectedText || target || '');

    setIsLinkPopoverOpen(true);
  }, [editor, inferLinkType]);

  useEffect(() => {
    if (!isLinkPopoverOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        linkPopoverRef.current &&
        !linkPopoverRef.current.contains(target) &&
        linkButtonRef.current &&
        !linkButtonRef.current.contains(target)
      ) {
        closeLinkPopover();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLinkPopoverOpen, closeLinkPopover]);

  const applyLinkFromForm = useCallback(() => {
    if (!editor) {
      return;
    }

    const trimmedTarget = linkFormTarget.trim();
    const trimmedText = linkFormText.trim();

    if (!trimmedTarget) {
      closeLinkPopover();
      return;
    }

    const href =
      linkFormType === 'email'
        ? `mailto:${trimmedTarget}`
        : linkFormType === 'phone'
        ? `tel:${trimmedTarget}`
        : linkFormType === 'sms'
        ? `sms:${trimmedTarget}`
        : trimmedTarget;

    const textContent = trimmedText || trimmedTarget;

    const { from, to } = editor.state.selection;
    const chain = editor.chain().focus();
    const newFrom = from;
    const newTo = from + textContent.length;

    if (from === to) {
      chain.insertContent(textContent);
    } else {
      chain.insertContentAt({ from, to }, textContent);
    }

    chain.setTextSelection({ from: newFrom, to: newTo }).extendMarkRange('link').setLink({ href }).run();
    closeLinkPopover();
  }, [editor, linkFormTarget, linkFormText, linkFormType, closeLinkPopover]);

  const removeLink = useCallback(() => {
    if (!editor) {
      return;
    }
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    closeLinkPopover();
  }, [editor, closeLinkPopover]);

  const addImage = useCallback(() => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (file) {
        // Read the file as a data URL
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const url = readerEvent.target?.result as string;
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    
    // Trigger the file input
    input.click();
  }, [editor]);

  return (
    <div className="inline-flex items-center gap-0.5 flex-wrap">
        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="toolbar-btn"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="toolbar-btn"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
        
        {/* Print */}
        <button
          onClick={() => window.print()}
          className="toolbar-btn"
          title="Print (Ctrl+P)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
        
        {/* Spell Check */}
        <button
          className="toolbar-btn"
          title="Spelling and grammar check (Ctrl+Alt+X)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </button>
        
      <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

      {/* Style Formatter */}
      <div className="relative inline-flex" ref={styleMenuRef}>
        <button
          type="button"
          className={isFormatPainterActive && copiedFormatting ? 'toolbar-btn-active' : 'toolbar-btn'}
          title={
            isFormatPainterActive && copiedFormatting
              ? 'Format painter active – select text to apply styling. Click again to stop.'
              : 'Copy formatting from the current selection'
          }
          onClick={handleStyleFormatterClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M22.703,1.87c-.392-.389-1.026-.384-1.414,.008l-3.842,3.884c-1.415-1.229-4.119-2.859-7.507-.065-.511,.289-3.393,1.917-5.023,2.756-1.084,.557-2.842,1.261-2.876,1.279-.554,.297-.913,.827-1.013,1.491-.35,2.331,2.576,5.853,5.093,8.397,1.837,1.857,3.739,2.799,5.654,2.799h0c1.642,0,3.264-.725,4.567-2.043,1.953-1.975,2.545-4.913,2.692-5.872,2.601-3.295,1.031-5.928-.177-7.327l3.851-3.893c.389-.393,.385-1.026-.008-1.414Zm-5.953,5.983c1.766,1.765,2.148,3.122,1.211,4.702l-5.913-5.913c1.581-.937,2.937-.555,4.702,1.211Zm-1.827,11.116c-.938,.948-2.026,1.449-3.146,1.449-.647,0-1.309-.168-1.98-.501,.085-.062,.168-.123,.244-.182,.691-.538,1.796-1.612,1.843-1.658,.396-.385,.403-1.019,.018-1.414-.385-.396-1.019-.403-1.414-.019-.011,.01-1.07,1.042-1.674,1.512-.239,.186-.561,.402-.766,.537-.168-.151-.335-.31-.504-.481-.92-.93-1.66-1.755-2.254-2.48,.249-.106,.52-.226,.753-.342,.956-.477,2.545-1.505,2.612-1.548,.464-.301,.596-.92,.295-1.383-.3-.463-.919-.595-1.383-.295-.016,.01-1.561,1.01-2.416,1.437-.341,.17-.806,.362-1.092,.477-1.04-1.578-1.141-2.395-1.074-2.577,.392-.158,1.824-.745,2.848-1.271,1.342-.691,3.444-1.865,4.51-2.465l6.676,6.675c-.171,.937-.699,3.117-2.096,4.529Z" />
          </svg>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          title="Paragraph styles"
          onClick={() => setIsStyleMenuOpen((prev) => !prev)}
        >
          <ChevronDown size={16} />
        </button>
        {isStyleMenuOpen && (
          <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
            {styleOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  option.action();
                  setIsStyleMenuOpen(false);
                }}
                className={`block w-full px-3 py-2 text-sm text-left transition-colors ${
                  option.active ? 'bg-indigo-50 text-indigo-600 font-medium' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

      {/* Font Family */}
      <select
        onChange={(e) => {
          const value = e.target.value;
          if (value === 'default') {
            editor.chain().focus().unsetFontFamily().run();
          } else {
            editor.chain().focus().setFontFamily(value).run();
          }
        }}
        className="google-toolbar-select"
        style={{ minWidth: '50px' }}
        title="Font"
      >
        <option value="default">Arial</option>
        <option value="Roboto">Roboto</option>
        <option value="'Times New Roman'">Times New Roman</option>
        <option value="'Courier New'">Courier New</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
        <option value="'Comic Sans MS'">Comic Sans MS</option>
      </select>

        {/* Font Size */}
        <div className="relative">
          <button 
            className="toolbar-btn" 
            title="Decrease font size"
            onClick={() => {
              const currentSize = editor.getAttributes('textStyle').fontSize;
              const sizes = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '36px', '48px'];
              const currentIndex = sizes.indexOf(currentSize || '16px');
              if (currentIndex > 0) {
                editor.chain().focus().setFontSize(sizes[currentIndex - 1]).run();
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        
        <select
          onChange={(e) => {
            const size = e.target.value;
            if (size === 'default') {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(size).run();
            }
          }}
          value={editor.getAttributes('textStyle').fontSize || '16px'}
          className="google-toolbar-select google-font-size"
          style={{ width: '50px' }}
          title="Font size"
        >
          <option value="8px">8</option>
          <option value="9px">9</option>
          <option value="10px">10</option>
          <option value="11px">11</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="22px">22</option>
          <option value="24px">24</option>
          <option value="28px">28</option>
          <option value="36px">36</option>
          <option value="48px">48</option>
        </select>
        
        <div className="relative">
          <button 
            className="toolbar-btn" 
            title="Increase font size"
            onClick={() => {
              const currentSize = editor.getAttributes('textStyle').fontSize;
              const sizes = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '36px', '48px'];
              const currentIndex = sizes.indexOf(currentSize || '16px');
              if (currentIndex < sizes.length - 1) {
                editor.chain().focus().setFontSize(sizes[currentIndex + 1]).run();
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        
        <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

        {/* Bold, Italic, Underline */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={16} strokeWidth={2.5} />
        </button>
        
        {/* Text Color */}
        <div className="relative">
          <button
            ref={textColorButtonRef}
            className="toolbar-btn"
            title="Text color"
            type="button"
            onClick={() => {
              if (isTextColorMenuOpen) {
                closeTextColorMenu();
                return;
              }
              closeHighlightColorMenu();
              updateTextColorMenuPosition();
              setIsTextColorMenuOpen(true);
            setTextCustomColor(currentTextColor ?? '#000000');
            setIsTextCustomMode(false);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" data-name="Layer 1" viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M20.766,24h3.234L15.307,1.938c-.596-1.195-1.797-1.938-3.133-1.938-1.358,0-2.539,.749-3.173,2.031L0,24H3.25l2.455-6h12.702l2.36,6ZM6.932,15L11.728,3.277c.177-.357,.778-.234,.845-.109l4.653,11.832H6.932Z"/>
</svg>
          </button>
        </div>
        {isTextColorMenuOpen &&
          textColorMenuPosition &&
          createPortal(
            <div
              ref={textColorMenuRef}
              className="z-[9999] w-60 space-y-3 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
              style={{
                position: 'absolute',
                top: textColorMenuPosition.top,
                left: textColorMenuPosition.left,
              }}
            >
              {isTextCustomMode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setIsTextCustomMode(false)}
                    >
                      Back
                    </button>
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Custom</span>
                    <span className="w-10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={textCustomColor}
                      onChange={(e) => setTextCustomColor(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border border-gray-200"
                    />
                    <input
                      type="text"
                      value={textCustomColor}
                      onChange={(e) => {
                        const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                        setTextCustomColor(value.slice(0, 7));
                      }}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      onClick={() => {
                        setTextCustomColor(currentTextColor ?? '#000000');
                        setIsTextCustomMode(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                      onClick={() => {
                        editor.chain().focus().setColor(textCustomColor).run();
                        closeTextColorMenu();
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Text</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        editor.chain().focus().unsetColor().run();
                        closeTextColorMenu();
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  {renderColorGrid(GOOGLE_TEXT_COLORS, currentTextColor, (color) => {
                    editor.chain().focus().setColor(color).run();
                    closeTextColorMenu();
                  })}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-sm border border-gray-200"
                      style={{ backgroundColor: currentTextColor ?? '#000000' }}
                      title="Current color"
                    />
                    <button
                      type="button"
                      className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200"
                      onClick={() => {
                        setTextCustomColor(currentTextColor ?? '#000000');
                        setIsTextCustomMode(true);
                      }}
                    >
                      Custom...
                    </button>
                  </div>
                </>
              )}
            </div>,
            document.body
          )}
        
        {/* Highlight Color */}
        <div className="relative">
          <button
            ref={highlightColorButtonRef}
            className="toolbar-btn"
            title="Highlight color"
            type="button"
            onClick={() => {
              if (isHighlightColorMenuOpen) {
                closeHighlightColorMenu();
                return;
              }
              closeTextColorMenu();
              updateHighlightColorMenuPosition();
              setIsHighlightColorMenuOpen(true);
            setHighlightCustomColor(currentHighlightColor ?? '#ffff00');
            setIsHighlightCustomMode(false);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" width="16" height="16" viewBox="0 0 24 24" data-name="Layer 1">
              <path fill="currentColor" d="m22.327 18.422c.728 1.034 1.673 2.229 1.673 3.078a2.5 2.5 0 0 1 -5 0c0-.775.961-2.008 1.692-3.069a1 1 0 0 1 1.635-.009zm-.875-3.853-7.82 7.82a5.508 5.508 0 0 1 -7.778 0l-4.243-4.243a5.5 5.5 0 0 1 0-7.778l3.818-3.818-2.99-2.989a1.5 1.5 0 0 1 2.122-2.122l2.989 2.99 1.881-1.881a1.5 1.5 0 0 1 2.13-2.109l12 12a1.5 1.5 0 0 1 -2.109 2.13zm-2.123-2.119-7.779-7.779-1.879 1.879 3.89 3.889a1.5 1.5 0 0 1 -2.122 2.122l-3.889-3.89-3.818 3.818a2.5 2.5 0 0 0 0 3.536l4.243 4.243a2.5 2.5 0 0 0 3.536 0z"/>
</svg>
          </button>
        </div>
        {isHighlightColorMenuOpen &&
          highlightColorMenuPosition &&
          createPortal(
            <div
              ref={highlightColorMenuRef}
              className="z-[9999] w-60 space-y-3 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
              style={{
                position: 'absolute',
                top: highlightColorMenuPosition.top,
                left: highlightColorMenuPosition.left,
              }}
            >
              {isHighlightCustomMode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setIsHighlightCustomMode(false)}
                    >
                      Back
                    </button>
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Custom</span>
                    <span className="w-10" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={highlightCustomColor}
                      onChange={(e) => setHighlightCustomColor(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border border-gray-200"
                    />
                    <input
                      type="text"
                      value={highlightCustomColor}
                      onChange={(e) => {
                        const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                        setHighlightCustomColor(value.slice(0, 7));
                      }}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      onClick={() => {
                        setHighlightCustomColor(currentHighlightColor ?? '#ffff00');
                        setIsHighlightCustomMode(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                      onClick={() => {
                        editor.chain().focus().setHighlight({ color: highlightCustomColor }).run();
                        closeHighlightColorMenu();
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Highlight</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        editor.chain().focus().unsetHighlight().run();
                        closeHighlightColorMenu();
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  {renderColorGrid(GOOGLE_HIGHLIGHT_COLORS, currentHighlightColor, (color) => {
                    editor.chain().focus().setHighlight({ color }).run();
                    closeHighlightColorMenu();
                  })}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-sm border border-gray-200"
                      style={{ backgroundColor: currentHighlightColor ?? '#ffff00' }}
                      title="Current highlight"
                    />
                    <button
                      type="button"
                      className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200"
                      onClick={() => {
                        setHighlightCustomColor(currentHighlightColor ?? '#ffff00');
                        setIsHighlightCustomMode(true);
                      }}
                    >
                      Custom...
                    </button>
                  </div>
                </>
              )}
            </div>,
            document.body
          )}
        
        <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

        {/* Link */}
        <button
          ref={linkButtonRef}
          onClick={() => {
            if (isLinkPopoverOpen) {
              closeLinkPopover();
            } else {
              openLinkPopover();
            }
          }}
          className={editor.isActive('link') ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Insert link (Ctrl+K)"
        >
          <Link2 size={16} />
        </button>
        {isLinkPopoverOpen && linkPopoverPosition &&
          createPortal(
            <div
              ref={linkPopoverRef}
              className="z-[9999] w-72 space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg"
              style={{
                position: 'absolute',
                top: linkPopoverPosition.top,
                left: linkPopoverPosition.left,
              }}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Insert Link</span>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={closeLinkPopover}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Text</label>
                <input
                  value={linkFormText}
                  onChange={(e) => setLinkFormText(e.target.value)}
                  placeholder="Visible text"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Link Type</label>
                <select
                  value={linkFormType}
                  onChange={(e) => setLinkFormType(e.target.value as typeof linkFormType)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="email">Mail</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="url">URL</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">
                  {linkFormType === 'email'
                    ? 'Email Address'
                    : linkFormType === 'phone'
                    ? 'Phone Number'
                    : linkFormType === 'sms'
                    ? 'Phone Number'
                    : 'Link URL'}
                </label>
                <input
                  value={linkFormTarget}
                  onChange={(e) => setLinkFormTarget(e.target.value)}
                  placeholder={
                    linkFormType === 'email'
                      ? 'example@domain.com'
                      : linkFormType === 'phone' || linkFormType === 'sms'
                      ? '+1-555-123-4567'
                      : 'https://example.com'
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-600"
                  onClick={removeLink}
                >
                  Remove link
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    onClick={closeLinkPopover}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    onClick={applyLinkFromForm}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        
        {/* Insert Image */}
        <button
          onClick={addImage}
          className="toolbar-btn"
          title="Insert image"
        >
          <ImageIcon size={16} />
        </button>
        
        <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

        {/* Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Align left (Ctrl+Shift+L)"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Align center (Ctrl+Shift+E)"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Align right (Ctrl+Shift+R)"
        >
          <AlignRight size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Justify (Ctrl+Shift+J)"
        >
          <AlignJustify size={16} />
        </button>
        
        <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

        {/* Line Spacing */}
        <button className="toolbar-btn" title="Line & paragraph spacing">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8h18M3 16h18M7 4v16M17 4v16" strokeLinecap="round"/>
          </svg>
        </button>
        
        <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Bulleted list (Ctrl+Shift+8)"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'toolbar-btn-active' : 'toolbar-btn'}
          title="Numbered list (Ctrl+Shift+7)"
        >
          <ListOrdered size={16} />
        </button>
        
        {/* Decrease/Increase Indent */}
       
      

        <div className="w-px h-6 bg-[#dadce0] mx-1"></div>

        {/* Variable */}
        {onVariableClick && (
          <button
            onClick={onVariableClick}
            className="toolbar-btn"
            title="Insert variable"
          >
           <svg xmlns="http://www.w3.org/2000/svg" id="Layer_1" data-name="Layer 1" viewBox="0 0 24 24" width="16" height="16">
  <path fill="currentColor" d="m5,10c0-.552.448-1,1-1h3v-3c0-.552.448-1,1-1s1,.448,1,1v3h3c.552,0,1,.448,1,1s-.448,1-1,1h-3v3c0,.552-.448,1-1,1s-1-.448-1-1v-3h-3c-.552,0-1-.448-1-1Zm19-1v10c0,2.757-2.243,5-5,5h-10c-2.446,0-4.479-1.768-4.908-4.092-2.324-.429-4.092-2.462-4.092-4.908V5C0,2.243,2.243,0,5,0h10c2.446,0,4.479,1.768,4.908,4.092,2.324.429,4.092,2.462,4.092,4.908ZM5,18h10c1.654,0,3-1.346,3-3V5c0-1.654-1.346-3-3-3H5c-1.654,0-3,1.346-3,3v10c0,1.654,1.346,3,3,3Zm17-9c0-1.302-.839-2.402-2-2.816v8.816c0,2.757-2.243,5-5,5H6.184c.414,1.161,1.514,2,2.816,2h10c1.654,0,3-1.346,3-3v-10Z"/>
</svg>

          </button>
        )}
    </div>
  );
};

export default function TiptapEditor({ content, onChange, placeholder = 'Start typing...', onVariableClick, onEditorReady }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
      }),
      ResizableImage,
      Placeholder.configure({
        placeholder,
      }),
      SlashCommand.configure({
        suggestion: {
          char: '/',
          startOfLine: false,
          items: ({ query }: { query: string }) => {
            return slashCommands
              .filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 10);
          },
          render: () => {
            let component: ReactRenderer<SlashCommandMenuHandle> | null = null;
            let popup: TippyInstance[] | null = null;

            const getMenu = () => component?.ref as SlashCommandMenuHandle | undefined;

            let renderProps: any = null;

            const handleApply = (item: CommandItem) => {
              if (!renderProps) return;
              const { editor, range } = renderProps;
              editor.chain().focus().deleteRange(range).run();
              item.command(editor);
              popup?.[0]?.hide();
            };

            const update = (props: any) => {
              component?.updateProps({
                items: props.items ?? [],
                onSelect: handleApply,
              });
            };

            return {
              onStart: (props: any) => {
                renderProps = props;
                component = new ReactRenderer(SlashCommandMenu, {
                  props: {
                    items: props.items ?? [],
                    onSelect: handleApply,
                  },
                  editor: props.editor,
                });

                getMenu()?.reset();

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  maxWidth: 'none',
                });

                update(props);
              },

              onUpdate(props: any) {
                renderProps = props;
                update(props);
                const menu = getMenu();
                const count = menu?.getItemsCount() ?? 0;
                if (count > 0 && menu && menu.getSelectedIndex() >= count) {
                  menu.setSelectedIndex(count - 1);
                }

                if (!props.clientRect) {
                  return;
                }

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props: any) {
                const event = props.event;
                const menu = getMenu();
                const count = menu?.getItemsCount() ?? 0;

                if (!menu || !count) {
                  if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                  }
                  return false;
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  popup?.[0]?.hide();
                  return true;
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  event.stopPropagation();
                  menu.setSelectedIndex(menu.getSelectedIndex() - 1);
                  return true;
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  event.stopPropagation();
                  menu.setSelectedIndex(menu.getSelectedIndex() + 1);
                  return true;
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  menu.selectCurrentItem();
                  return true;
                }

                return false;
              },

              onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
                component = null;
                popup = null;
                renderProps = null;
              },
            };
          },
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none',
      },
    },
    onCreate: ({ editor }) => {
      if (onEditorReady) {
        onEditorReady(editor);
      }
    },
  });

  return (
    <div className="tiptap-container">
      <EditorContent editor={editor} />
    </div>
  );
}

// Export MenuBar separately so it can be used outside
export { MenuBar };

