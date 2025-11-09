// TenCinque DefineExtension: Letter spacing control for TipTap
import { Extension } from '@tiptap/core';

const DEFAULT_LETTER_SPACING = ['0em', '0.05em', '0.1em', '0.15em', '0.2em', '0.5px'];

export const LetterSpacing = Extension.create({
  name: 'letterSpacing',

  addOptions() {
    return {
      types: ['textStyle'],
      defaultLetterSpacing: null,
      validLetterSpacings: DEFAULT_LETTER_SPACING,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          letterSpacing: {
            default: this.options.defaultLetterSpacing,
            parseHTML: element => element.style.letterSpacing || null,
            renderHTML: attributes => {
              if (!attributes.letterSpacing) {
                return {};
              }

              return {
                style: `letter-spacing: ${attributes.letterSpacing}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLetterSpacing:
        value =>
        ({ chain }) => {
          const letterSpacing = this.options.validLetterSpacings.includes(String(value))
            ? String(value)
            : this.options.defaultLetterSpacing;

          return chain()
            .setMark('textStyle', {
              letterSpacing,
            })
            .run();
        },

      unsetLetterSpacing:
        () =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', { letterSpacing: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

export default LetterSpacing;

