// TenCinque DefineExtension: Line height control for TipTap
import { Extension } from '@tiptap/core';

const DEFAULT_LINE_HEIGHTS = ['0.5', '0.75', '1', '1.2', '1.5', '1.75', '2', '2.5'];

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: null,
      validLineHeights: DEFAULT_LINE_HEIGHTS,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultLineHeight,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => {
              if (!attributes.lineHeight) {
                return {};
              }

              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const applyToSelectedBlocks = (command, attrs) => {
      return this.options.types.reduce(
        (chain, type) => chain.updateAttributes(type, attrs),
        command,
      );
    };

    return {
      setLineHeight:
        value =>
        ({ chain }) => {
          const target = this.options.validLineHeights.includes(String(value))
            ? String(value)
            : this.options.defaultLineHeight;

          const attrs =
            target === null
              ? { lineHeight: null }
              : { lineHeight: target };

          return applyToSelectedBlocks(chain().focus(), attrs).run();
        },

      unsetLineHeight:
        () =>
        ({ chain }) =>
          applyToSelectedBlocks(chain().focus(), { lineHeight: null }).run(),
    };
  },
});

export default LineHeight;

