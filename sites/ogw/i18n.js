// The dictionaries of Mega Stores Gear World (lessons L24, L195): one file per language, keyed by the English text of
// the page, in the same layout as the sites' public/assets/i18n files (keys in code-point order, one space, a new line
// at the end). The Worker writes each page in the visitor's language from them (src/marketplace-guides.js); they are
// not served as files (this site has no script to read them).
import el from './i18n/el-GR.json' with { type: 'json' };
import de from './i18n/de-DE.json' with { type: 'json' };
import fr from './i18n/fr-FR.json' with { type: 'json' };
import it from './i18n/it-IT.json' with { type: 'json' };
import es from './i18n/es-ES.json' with { type: 'json' };
import pt from './i18n/pt-PT.json' with { type: 'json' };
import nl from './i18n/nl-NL.json' with { type: 'json' };
import pl from './i18n/pl-PL.json' with { type: 'json' };
import sq from './i18n/sq-AL.json' with { type: 'json' };
import ro from './i18n/ro-RO.json' with { type: 'json' };
import ru from './i18n/ru-RU.json' with { type: 'json' };

export default {
  'el-GR': el, 'de-DE': de, 'fr-FR': fr, 'it-IT': it, 'es-ES': es, 'pt-PT': pt,
  'nl-NL': nl, 'pl-PL': pl, 'sq-AL': sq, 'ro-RO': ro, 'ru-RU': ru
};
