import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@phytalessence.com' },
    update: {},
    create: {
      email: 'admin@phytalessence.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Phytalessence',
      role: AdminRole.ADMIN,
    },
  });
  console.log(`Created admin: ${admin.email}`);

  // Create Phytalessence products catalog
  const products = [
    'Acide Hyaluronique 600 + Collagène Marin',
    'Argan - Co Q10 Bourrache',
    'Artichaut - Mono plante Bio',
    'Artiphytol',
    'Ashwagandha - Mono plante Bio',
    'Audiphyt',
    'Bardane Pensée Sauvage',
    'Bisglycinate de Calcium',
    'Bisglycinate de Fer',
    'Bisglycinate de Zinc',
    'Bronchophytal',
    'Calme & Sérénité',
    'Chaga - Champignon Bio',
    'Cheveux & Ongles',
    'Chlorhydrate de Berbérine',
    'Circulation',
    'Co Enzyme Q10 Glutathion',
    'Coffret Cheveux & Ongles',
    'Coffret Immunité',
    'Coffret Minceur Action+',
    'Coffret Programme Minceur Intégral',
    'Coffret Solaire',
    'Collagène Cheveux',
    'Collagène Marin 100% Pur',
    'Collagène Marin Premiumflex',
    'Collagène Marin Sticks',
    'Complexe Vitamines B',
    'Cordyceps - Champignon Bio',
    'Cumin - Mono plante Bio',
    'Curcuma - Mono plante Bio',
    'Cysti Premium',
    'Détox Desmodium',
    'Endocare',
    'Endorphyt Formule Renforcée',
    'Équilibre Acido Basique',
    'Extrait de Pépins de Pamplemousse',
    'Ferments Lactiques',
    'Flore Vaginale',
    'Gel Artiphytol',
    'Gel Celluphyt',
    'Gel Circulation',
    'Gelée Royale - Mono plante Bio',
    'Ginkgo - Mono plante Bio',
    'Ginseng - Mono plante Bio',
    'Glucosamine Calcium | Silice | MSM',
    'Grenade - Mono plante Bio',
    'Guarana - Mono plante Bio',
    'Harpagophytum - Mono plante Bio',
    'Huile de Lin - Oméga 3',
    'Konjac - Mono plante Bio',
    'Kudzu - Mono plante Bio',
    'L-Glutamine',
    'Levure de Riz Rouge',
    'Libphyt Homme',
    'Lion\'s Mane - Champignon Bio',
    'Maca - Mono plante Bio',
    'Magnésium Marin B6',
    'Magnésium Marin B6 Enfant',
    'Maïtaké - Champignon Bio',
    'Mémoire',
    'Ménopause',
    'Minceur Action+',
    'Moringa - Mono plante Bio',
    'Passiflore - Mono plante Bio',
    'Pépins de Courge - Mono plante Bio',
    'Phytenergy',
    'Phytfroid+',
    'Phytal\'Défenses+',
    'Phytal\'Slim',
    'Phytal\'Draine',
    'Phytal\'Digest',
    'Picolinate de Chrome',
    'Prêle - Mono plante Bio',
    'Prostate',
    'Reishi - Champignon Bio',
    'Rhodiola - Mono plante Bio',
    'Shiitaké - Champignon Bio',
    'Shilajit Résine',
    'Solaire',
    'Sommeil Formule Renforcée',
    'Spiruline - Mono plante Bio',
    'Thyro+',
    'Tonus & Équilibre',
    'Transit',
    'Tribulus - Mono plante Bio',
    'Ultimate Acide Hyaluronique 1200 mg',
    'Ultimate Acide Hyaluronique 1200 mg - DUO',
    'Valériane - Mono plante Bio',
    'Ventre Plat',
    'Vigne Rouge - Mono plante Bio',
    'Vision Confort',
    'Vitamine C Acérola',
    'Vitamine D3',
    'Vitamine D3 + K2',
  ];

  // Check existing products to avoid duplicates
  const existingProducts = await prisma.product.findMany({
    select: { name: true },
  });
  const existingNames = new Set(existingProducts.map((p) => p.name.toLowerCase()));

  const newProducts = products.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (newProducts.length > 0) {
    await prisma.product.createMany({
      data: newProducts.map((name) => ({ name, active: true })),
    });
    console.log(`Created ${newProducts.length} new products`);
  } else {
    console.log('All products already exist');
  }
  console.log(`Total products in catalog: ${products.length}`);

  // Create default settings (keys must match backend expectations)
  const defaultSettings = [
    { key: 'POINTS_RATIO', value: '1', description: 'Nombre de points par euro depense' },
    { key: 'POINTS_ROUNDING', value: 'floor', description: 'Methode d\'arrondi des points (floor, ceil, round)' },
    { key: 'MIN_ELIGIBLE_AMOUNT', value: '0', description: 'Montant minimum pour gagner des points' },
    { key: 'notification_message_template', value: 'Felicitations ! Vous avez gagne {points} points sur votre achat Phytalessence.', description: 'Template du message de notification' },
    // Snapss settings (hidden from UI)
    { key: 'SNAPSS_HOST', value: 'https://2o9eiez52a.execute-api.eu-west-1.amazonaws.com', description: 'URL base Snapss API' },
    { key: 'SNAPSS_API_KEY', value: '', description: 'Snapss API Key' },
    { key: 'SNAPSS_API_PASS', value: '', description: 'Snapss API Pass' },
    { key: 'SNAPSS_API_KEY_DN', value: '', description: 'Snapss API Key DN' },
    { key: 'SNAPSS_API_PASS_DN', value: '', description: 'Snapss API Pass DN' },
    { key: 'SNAPSS_TEMPLATE_ID', value: '', description: 'Snapss Template ID' },
    { key: 'SNAPSS_COLLECTION_INDEX', value: '', description: 'Snapss Collection Index' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
    console.log(`Created setting: ${setting.key}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
