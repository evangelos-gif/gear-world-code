// Texts of version 1.0.2 in the 11 Hub languages (25/11/2026): price alerts for saved products and the delivery
// country. Like the 1.0.1 texts, the retailer is named by its own name ({retailer}), never "shop" or "partner", and
// a price alert says only the new price and the day it was checked: never "discount", "%", "sale" or "price drop"
// (lessons L107, Manager 24/11/2026).
export const RELEASE_KEYS = [
  'alertOn', 'alertOff', 'alertHint', 'alertTitle', 'alertBody', 'alertsOff', 'openSettings', 'alertChannel', 'alertTag',
  'deliverTitle', 'deliverAuto', 'deliverHint'
] as const;

export type ReleaseKey = (typeof RELEASE_KEYS)[number];

export const RELEASE_STRINGS: Record<string, Record<ReleaseKey, string>> = {
  'en-GB': {
    alertOn: 'Price alert on',
    alertOff: 'Tell me about a lower price',
    alertHint: "Your phone checks this saved product and tells you when the retailer's price is lower. No account, your list stays on your phone.",
    alertTitle: 'New price at {retailer}',
    alertBody: '{name}: {price}. Price checked {date}, may change.',
    alertsOff: 'Notifications from Gear World are off on this phone.',
    openSettings: 'Open phone settings',
    alertChannel: 'Price alerts',
    alertTag: 'Price alert',
    deliverTitle: 'Delivery country',
    deliverAuto: 'Automatic (where you are)',
    deliverHint: 'Shows the products that retailers deliver to this country.'
  },
  'el-GR': {
    alertOn: 'Ειδοποίηση τιμής: ενεργή',
    alertOff: 'Ειδοποιήστε με για χαμηλότερη τιμή',
    alertHint: 'Το κινητό σας ελέγχει αυτό το αποθηκευμένο προϊόν και σας ειδοποιεί όταν η τιμή στο κατάστημα είναι χαμηλότερη. Χωρίς λογαριασμό, η λίστα σας μένει στο κινητό.',
    alertTitle: 'Νέα τιμή στο {retailer}',
    alertBody: '{name}: {price}. Έλεγχος τιμής {date}, μπορεί να αλλάξει.',
    alertsOff: 'Οι ειδοποιήσεις του Gear World είναι κλειστές σε αυτό το κινητό.',
    openSettings: 'Ρυθμίσεις κινητού',
    alertChannel: 'Ειδοποιήσεις τιμής',
    alertTag: 'Ειδοποίηση τιμής',
    deliverTitle: 'Χώρα παράδοσης',
    deliverAuto: 'Αυτόματα (εκεί που βρίσκεστε)',
    deliverHint: 'Δείχνει τα προϊόντα που τα καταστήματα παραδίδουν σε αυτή τη χώρα.'
  },
  'de-DE': {
    alertOn: 'Preisalarm an',
    alertOff: 'Bei niedrigerem Preis benachrichtigen',
    alertHint: 'Ihr Handy prüft dieses gemerkte Produkt und benachrichtigt Sie, wenn der Preis beim Händler niedriger ist. Ohne Konto, Ihre Liste bleibt auf dem Handy.',
    alertTitle: 'Neuer Preis bei {retailer}',
    alertBody: '{name}: {price}. Preis geprüft am {date}, kann sich ändern.',
    alertsOff: 'Mitteilungen von Gear World sind auf diesem Handy aus.',
    openSettings: 'Handy-Einstellungen öffnen',
    alertChannel: 'Preisalarme',
    alertTag: 'Preisalarm',
    deliverTitle: 'Lieferland',
    deliverAuto: 'Automatisch (wo Sie sind)',
    deliverHint: 'Zeigt die Produkte, die Händler in dieses Land liefern.'
  },
  'fr-FR': {
    alertOn: 'Alerte prix activée',
    alertOff: 'Me prévenir d’un prix plus bas',
    alertHint: 'Votre téléphone vérifie ce produit enregistré et vous prévient quand le prix chez le marchand est plus bas. Sans compte, votre liste reste sur votre téléphone.',
    alertTitle: 'Nouveau prix chez {retailer}',
    alertBody: '{name} : {price}. Prix vérifié le {date}, peut changer.',
    alertsOff: 'Les notifications de Gear World sont désactivées sur ce téléphone.',
    openSettings: 'Ouvrir les réglages du téléphone',
    alertChannel: 'Alertes prix',
    alertTag: 'Alerte prix',
    deliverTitle: 'Pays de livraison',
    deliverAuto: 'Automatique (là où vous êtes)',
    deliverHint: 'Affiche les produits que les marchands livrent dans ce pays.'
  },
  'it-IT': {
    alertOn: 'Avviso prezzo attivo',
    alertOff: 'Avvisami di un prezzo più basso',
    alertHint: 'Il telefono controlla questo prodotto salvato e ti avvisa quando il prezzo del rivenditore è più basso. Senza account, la tua lista resta sul telefono.',
    alertTitle: 'Nuovo prezzo da {retailer}',
    alertBody: '{name}: {price}. Prezzo controllato il {date}, può cambiare.',
    alertsOff: 'Le notifiche di Gear World sono disattivate su questo telefono.',
    openSettings: 'Apri le impostazioni del telefono',
    alertChannel: 'Avvisi prezzo',
    alertTag: 'Avviso prezzo',
    deliverTitle: 'Paese di consegna',
    deliverAuto: 'Automatico (dove ti trovi)',
    deliverHint: 'Mostra i prodotti che i rivenditori consegnano in questo paese.'
  },
  'es-ES': {
    alertOn: 'Aviso de precio activado',
    alertOff: 'Avísame de un precio más bajo',
    alertHint: 'Tu móvil comprueba este producto guardado y te avisa cuando el precio del vendedor es más bajo. Sin cuenta, tu lista se queda en tu móvil.',
    alertTitle: 'Nuevo precio en {retailer}',
    alertBody: '{name}: {price}. Precio comprobado el {date}, puede cambiar.',
    alertsOff: 'Las notificaciones de Gear World están desactivadas en este móvil.',
    openSettings: 'Abrir ajustes del móvil',
    alertChannel: 'Avisos de precio',
    alertTag: 'Aviso de precio',
    deliverTitle: 'País de entrega',
    deliverAuto: 'Automático (donde estás)',
    deliverHint: 'Muestra los productos que los vendedores entregan en este país.'
  },
  'pt-PT': {
    alertOn: 'Alerta de preço ativo',
    alertOff: 'Avisar-me de um preço mais baixo',
    alertHint: 'O seu telemóvel verifica este produto guardado e avisa quando o preço no vendedor é mais baixo. Sem conta, a sua lista fica no telemóvel.',
    alertTitle: 'Novo preço em {retailer}',
    alertBody: '{name}: {price}. Preço verificado a {date}, pode mudar.',
    alertsOff: 'As notificações da Gear World estão desligadas neste telemóvel.',
    openSettings: 'Abrir definições do telemóvel',
    alertChannel: 'Alertas de preço',
    alertTag: 'Alerta de preço',
    deliverTitle: 'País de entrega',
    deliverAuto: 'Automático (onde está)',
    deliverHint: 'Mostra os produtos que os vendedores entregam neste país.'
  },
  'nl-NL': {
    alertOn: 'Prijsmelding aan',
    alertOff: 'Meld een lagere prijs',
    alertHint: 'Uw telefoon controleert dit bewaarde product en meldt het wanneer de prijs bij de verkoper lager is. Zonder account, uw lijst blijft op uw telefoon.',
    alertTitle: 'Nieuwe prijs bij {retailer}',
    alertBody: '{name}: {price}. Prijs gecontroleerd op {date}, kan veranderen.',
    alertsOff: 'Meldingen van Gear World staan uit op deze telefoon.',
    openSettings: 'Telefooninstellingen openen',
    alertChannel: 'Prijsmeldingen',
    alertTag: 'Prijsmelding',
    deliverTitle: 'Leverland',
    deliverAuto: 'Automatisch (waar u bent)',
    deliverHint: 'Toont de producten die verkopers in dit land leveren.'
  },
  'sq-AL': {
    alertOn: 'Njoftimi i çmimit aktiv',
    alertOff: 'Më njofto për një çmim më të ulët',
    alertHint: 'Telefoni juaj kontrollon këtë produkt të ruajtur dhe ju njofton kur çmimi te shitësi është më i ulët. Pa llogari, lista juaj mbetet në telefon.',
    alertTitle: 'Çmim i ri te {retailer}',
    alertBody: '{name}: {price}. Çmimi u kontrollua më {date}, mund të ndryshojë.',
    alertsOff: 'Njoftimet e Gear World janë të çaktivizuara në këtë telefon.',
    openSettings: 'Hap cilësimet e telefonit',
    alertChannel: 'Njoftime çmimi',
    alertTag: 'Njoftim çmimi',
    deliverTitle: 'Vendi i dorëzimit',
    deliverAuto: 'Automatik (ku ndodheni)',
    deliverHint: 'Shfaq produktet që shitësit i dorëzojnë në këtë vend.'
  },
  'ro-RO': {
    alertOn: 'Alertă de preț activă',
    alertOff: 'Anunță-mă de un preț mai mic',
    alertHint: 'Telefonul verifică acest produs salvat și te anunță când prețul la comerciant este mai mic. Fără cont, lista ta rămâne pe telefon.',
    alertTitle: 'Preț nou la {retailer}',
    alertBody: '{name}: {price}. Preț verificat pe {date}, se poate schimba.',
    alertsOff: 'Notificările Gear World sunt oprite pe acest telefon.',
    openSettings: 'Deschide setările telefonului',
    alertChannel: 'Alerte de preț',
    alertTag: 'Alertă de preț',
    deliverTitle: 'Țara de livrare',
    deliverAuto: 'Automat (unde te afli)',
    deliverHint: 'Arată produsele pe care comercianții le livrează în această țară.'
  },
  'ru-RU': {
    alertOn: 'Уведомление о цене включено',
    alertOff: 'Сообщить о более низкой цене',
    alertHint: 'Телефон проверяет этот сохранённый товар и сообщает, когда цена у продавца ниже. Без аккаунта, ваш список остаётся на телефоне.',
    alertTitle: 'Новая цена: {retailer}',
    alertBody: '{name}: {price}. Цена проверена {date}, может измениться.',
    alertsOff: 'Уведомления Gear World выключены на этом телефоне.',
    openSettings: 'Открыть настройки телефона',
    alertChannel: 'Уведомления о ценах',
    alertTag: 'Уведомление о цене',
    deliverTitle: 'Страна доставки',
    deliverAuto: 'Автоматически (где вы находитесь)',
    deliverHint: 'Показывает товары, которые продавцы доставляют в эту страну.'
  }
};
