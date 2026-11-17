import type { IssueCategory, LanguageCode, TicketStatus } from '../types/civic';

export interface TranslationBundle {
  nav: {
    ledger: string;
    priority: string;
    wards: string;
    audit: string;
    reportCta: string;
  };
  hero: {
    kicker: string;
    headline: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
  };
  categories: Record<IssueCategory, string>;
  statuses: Record<TicketStatus, string>;
  actions: {
    confirmPlusOne: string;
    confirmed: string;
    inspectTicket: string;
    resetFilters: string;
    exportJson: string;
  };
}

export const TRANSLATIONS: Record<LanguageCode, TranslationBundle> = {
  en: {
    nav: {
      ledger: 'Live Ledger',
      priority: 'Priority Engine',
      wards: 'Ward Scorecard',
      audit: 'Citizen Audit',
      reportCta: 'Log Civic Issue',
    },
    hero: {
      kicker: 'MIRA-BHAYANDAR MUNICIPAL LEDGER · WARDS 1–24',
      headline:
        'Every pothole, pipe leak, and uncollected bin in Mira-Bhayandar—tracked on a public clock.',
      lead: 'Log a geo-verified civic complaint in 30 seconds without creating an account. Nearby reports merge automatically, Priority Scores rank dispatch objectively, and overdue SLAs escalate straight to the Deputy Municipal Commissioner.',
      primaryCta: 'Log an Issue in 30 Seconds',
      secondaryCta: 'Inspect Live Ward Ledger',
    },
    categories: {
      water: 'Water Leak',
      drainage: 'Drainage & Manhole',
      garbage: 'Garbage Collection',
      road: 'Road & Pothole',
      streetlight: 'Streetlight',
    },
    statuses: {
      open: 'IN PROGRESS',
      sla_risk: 'SLA RISK',
      escalated: 'SLA BREACH · DMC',
      awaiting_audit: '48H CITIZEN AUDIT',
      verified: 'CITIZEN VERIFIED',
    },
    actions: {
      confirmPlusOne: '+1 Confirm',
      confirmed: 'Confirmed',
      inspectTicket: 'Inspect',
      resetFilters: 'Reset Filters',
      exportJson: 'Export Open JSON',
    },
  },
  mr: {
    nav: {
      ledger: 'थेट नोंदवही',
      priority: 'प्राधान्य इंजिन',
      wards: 'प्रभाग कामगिरी',
      audit: 'नागरिक पडताळणी',
      reportCta: 'तक्रार नोंदवा',
    },
    hero: {
      kicker: 'मीरा-भाईंदर महानगरपालिका नोंदवही · प्रभाग १–२४',
      headline:
        'मीरा-भाईंदरमधील प्रत्येक खड्डा, पाणी गळती आणि कचरा आता सार्वजनिक वेळेच्या घड्याळावर.',
      lead: 'खाते न उघडता ३० सेकंदांत भू-सत्यापित नागरी तक्रार नोंदवा. ५० मीटरमधील तक्रारी आपोआप एकत्र होतात आणि मुदत संपल्यास थेट उपायुक्तांकडे प्रकरण जाते.',
      primaryCta: '३० सेकंदांत तक्रार नोंदवा',
      secondaryCta: 'थेट प्रभाग नोंदवही पहा',
    },
    categories: {
      water: 'पाणी गळती',
      drainage: 'गटार व मॅनहोल',
      garbage: 'कचरा संकलन',
      road: 'रस्ते दुरुस्ती व खड्डे',
      streetlight: 'पथदिवे',
    },
    statuses: {
      open: 'कार्यवाही सुरू',
      sla_risk: 'SLA धोका',
      escalated: 'मुदत भंग · उपायुक्त',
      awaiting_audit: '४८ तास नागरिक तपासणी',
      verified: 'नागरिक सत्यापित',
    },
    actions: {
      confirmPlusOne: '+१ पुष्टी करा',
      confirmed: 'पुष्टी झाली',
      inspectTicket: 'तपासा',
      resetFilters: 'फिल्टर रीसेट करा',
      exportJson: 'JSON डाउनलोड करा',
    },
  },
  hi: {
    nav: {
      ledger: 'लाइव रजिस्टर',
      priority: 'प्राथमिकता इंजन',
      wards: 'वार्ड स्कोरकार्ड',
      audit: 'नागरिक ऑडिट',
      reportCta: 'शिकायत दर्ज करें',
    },
    hero: {
      kicker: 'मीरा-भायंदर नगर पालिका रजिस्टर · वार्ड 1–24',
      headline:
        'मीरा-भायंदर का हर गड्ढा, पानी का रिसाव और कचरा ढेर अब सार्वजनिक घड़ी पर दर्ज।',
      lead: 'बिना अकाउंट बनाए 30 सेकंड में जियो-सत्यापित शिकायत दर्ज करें। 50 मीटर के भीतर की रिपोर्ट अपने-आप जुड़ती हैं और समयसीमा पार होने पर मामला सीधे उपायुक्त को भेजा जाता है।',
      primaryCta: '30 सेकंड में शिकायत दर्ज करें',
      secondaryCta: 'लाइव वार्ड रजिस्टर देखें',
    },
    categories: {
      water: 'पानी रिसाव',
      drainage: 'नाला व मैनहोल',
      garbage: 'कचरा संग्रहण',
      road: 'सड़क व गड्ढे',
      streetlight: 'स्ट्रीटलाइट',
    },
    statuses: {
      open: 'प्रगति पर',
      sla_risk: 'SLA जोखिम',
      escalated: 'समयसीमा पार · DMC',
      awaiting_audit: '48 घंटे नागरिक जांच',
      verified: 'नागरिक सत्यापित',
    },
    actions: {
      confirmPlusOne: '+1 पुष्टि करें',
      confirmed: 'पुष्टि हुई',
      inspectTicket: 'जांचें',
      resetFilters: 'फ़िल्टर रीसेट करें',
      exportJson: 'JSON निर्यात करें',
    },
  },
};
