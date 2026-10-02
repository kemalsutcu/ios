import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

export interface Agent {
  id: string;
  name: string;
  role: string;
  category: string;
  description: string;
  url: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  tint: string;
  mode: string;
  features: string[];
}

// Public page addresses only. No agent/admin keys, signed sessions or credentials here.
// Change a URL here if the matching Wix page's published slug changes.
export const agents: Agent[] = [
  { id: 'belma', name: 'BELMA', role: 'Hukuk asistanınız', category: 'Hukuk',
    description: 'Uyuşmazlığınızı birlikte inceleyin. Belgeler, hukuk kaynakları ve dilekçe taslaklarıyla ilerleyin.',
    url: 'https://www.yapaymevzular.com/belma', icon: 'scale-outline', tint: '#E6EEDB', mode: 'Ses · Yazı · Belge',
    features: ['Bağlı bilgi bankasıyla hukuk araştırması', 'Belge inceleme ve çoklu dosya yükleme', 'Suç duyurusu taslağı ve UDF çıktısı'] },
  { id: 'aylin', name: 'AYLİN', role: 'Astroloji asistanınız', category: 'Astroloji',
    description: 'Doğum haritanız ve astrolojik sorularınız üzerine kişisel bir sohbet başlatın.',
    url: 'https://www.yapaymevzular.com/aylinastrolog', icon: 'moon-outline', tint: '#ECE6F2', mode: 'Ses · Yazı · Kişisel yorum',
    features: ['Doğum haritası üzerine görüşme', 'Astrolojik yorum ve açıklamalar', 'Sesli ajan deneyimi'] },
  { id: 'sahika', name: 'ŞAHİKA', role: 'Veterinerlik asistanınız', category: 'Veterinerlik',
    description: 'Hayvan bakımı ve veterinerlik konularında sorularınızı sesli olarak paylaşın.',
    url: 'https://www.yapaymevzular.com/sahika', icon: 'paw-outline', tint: '#F6E6D5', mode: 'Ses · Bilgilendirme',
    features: ['Hayvan bakımı konusunda bilgi', 'Veterinerlik odaklı sesli görüşme', 'Klinik hizmetleri hakkında yönlendirme'] },
  { id: 'can', name: 'CAN', role: 'Psikoloji ve farkındalık', category: 'İyi oluş',
    description: 'Duygularınıza, düşüncelerinize ve davranışlarınıza dair farkındalık için bir sohbet alanı.',
    url: 'https://www.yapaymevzular.com/can', icon: 'leaf-outline', tint: '#DDEEE4', mode: 'Sohbet · Farkındalık',
    features: ['Duygu, düşünce ve davranış üzerine sohbet', 'Genel psikoloji bilgisi', 'Kişisel farkındalık için sorular'] },
  { id: 'narin', name: 'NARİN', role: 'Mutfağınızdaki asistan', category: 'Günlük yaşam',
    description: 'Evdeki malzemelerle neler pişirebilirsiniz? Tarifler ve pratik mutfak fikirleri bulun.',
    url: 'https://www.yapaymevzular.com/narin', icon: 'restaurant-outline', tint: '#F1E9CF', mode: 'Tarif · Mutfak',
    features: ['Eldeki malzemelere göre yemek fikirleri', 'Tarif önerileri', 'Pratik mutfak bilgileri'] },
  { id: 'sude', name: 'SUDE', role: 'İslam hakkında bilgi', category: 'İnanç',
    description: 'Kur’an, ibadet, ahlak, dua ve siyer konularında sorularınızı paylaşın.',
    url: 'https://www.yapaymevzular.com/sude', icon: 'book-outline', tint: '#E0ECEC', mode: 'Bilgi · Sohbet',
    features: ['İslam ve Kur’an üzerine bilgi', 'İbadet, ahlak ve dua konuları', 'Hadis ve siyer hakkında açıklamalar'] },
  { id: 'ata', name: 'ATA', role: 'Tarihsel karakter deneyimi', category: 'Tarih ve sanat',
    description: 'Atatürk’ün yaşamını ve dönemini tarihsel bir karakter simülasyonu üzerinden keşfedin.',
    url: 'https://www.yapaymevzular.com/ata', icon: 'library-outline', tint: '#E8E4DE', mode: 'Tarih · Karakter simülasyonu',
    features: ['Atatürk’ün yaşamı üzerine bilgi', 'Dönemin tarihine dair sohbet', 'Yapay zekâ ile tarihsel karakter simülasyonu'] },
  { id: 'vincent', name: 'VINCENT', role: 'Sanatla bir sohbet', category: 'Tarih ve sanat',
    description: 'Van Gogh’un yaşamına, sanatına ve mektuplarına bir karakter simülasyonuyla yaklaşın.',
    url: 'https://www.yapaymevzular.com/vincent', icon: 'color-palette-outline', tint: '#F4E0CB', mode: 'Sanat · Karakter simülasyonu',
    features: ['Van Gogh’un yaşamı ve sanatı', 'Mektupları üzerine sohbet', 'Yapay zekâ ile tarihsel karakter simülasyonu'] },
];

export const categories = ['Tümü', ...new Set(agents.map((agent) => agent.category))];
export function filterAgents(query: string, category: string): Agent[] {
  const normalized = query.trim().toLocaleLowerCase('tr-TR');
  return agents.filter((agent) => (category === 'Tümü' || agent.category === category)
    && [agent.name, agent.role, agent.category, agent.description].join(' ').toLocaleLowerCase('tr-TR').includes(normalized));
}
