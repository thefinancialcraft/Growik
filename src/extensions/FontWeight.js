import { Extension } from '@tiptap/core';

const DEFAULT_WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];

export const FontWeight = Extension.create({
  name: 'fontWeight',

  addOptions() {
    return {
      types: ['textStyle'],
      defaultWeight: null,
      validWeights: DEFAULT_WEIGHTS,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontWeight: {
            default: this.options.defaultWeight,
            parseHTML: element => element.style.fontWeight || null,
            renderHTML: attributes => {
              if (!attributes.fontWeight) {
                return {};
              }
              return {
                style: `font-weight: ${attributes.fontWeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontWeight:
        weight =>
        ({ chain }) => {
          const value = this.options.validWeights.includes(String(weight))
            ? String(weight)
            : this.options.defaultWeight;

          return chain()
            .setMark('textStyle', {
              fontWeight: value,
            })
            .run();
        },

      unsetFontWeight:
        () =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', { fontWeight: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

export default FontWeight;

