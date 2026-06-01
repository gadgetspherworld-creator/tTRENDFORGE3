import { PrismaClient } from '@trendforge/database'

const prisma = new PrismaClient()

const COUNTRIES = [
  { countryCode:'US', ecommerceMaturity:1.00, avgCPC:1.20, logisticsScore:0.95, competitionDensity:0.85, avgOrderValue:45, language:'en' },
  { countryCode:'DE', ecommerceMaturity:0.92, avgCPC:0.90, logisticsScore:0.92, competitionDensity:0.45, avgOrderValue:38, language:'de' },
  { countryCode:'FR', ecommerceMaturity:0.88, avgCPC:0.85, logisticsScore:0.90, competitionDensity:0.52, avgOrderValue:35, language:'fr' },
  { countryCode:'GB', ecommerceMaturity:0.95, avgCPC:1.00, logisticsScore:0.88, competitionDensity:0.68, avgOrderValue:42, language:'en' },
  { countryCode:'ES', ecommerceMaturity:0.78, avgCPC:0.65, logisticsScore:0.85, competitionDensity:0.38, avgOrderValue:30, language:'es' },
  { countryCode:'IT', ecommerceMaturity:0.75, avgCPC:0.70, logisticsScore:0.82, competitionDensity:0.42, avgOrderValue:32, language:'it' },
  { countryCode:'NL', ecommerceMaturity:0.94, avgCPC:1.10, logisticsScore:0.96, competitionDensity:0.55, avgOrderValue:40, language:'nl' },
  { countryCode:'BE', ecommerceMaturity:0.89, avgCPC:0.95, logisticsScore:0.94, competitionDensity:0.48, avgOrderValue:36, language:'fr' },
  { countryCode:'PL', ecommerceMaturity:0.68, avgCPC:0.45, logisticsScore:0.78, competitionDensity:0.28, avgOrderValue:25, language:'pl' },
  { countryCode:'SE', ecommerceMaturity:0.93, avgCPC:1.05, logisticsScore:0.93, competitionDensity:0.41, avgOrderValue:43, language:'sv' },
]

async function main() {
  console.log('🌱 Seeding CountryMetric...')
  for (const c of COUNTRIES) {
    await prisma.countryMetric.upsert({
      where:  { countryCode: c.countryCode },
      update: { ecommerceMaturity: c.ecommerceMaturity, avgCPC: c.avgCPC, logisticsScore: c.logisticsScore, competitionDensity: c.competitionDensity, avgOrderValue: c.avgOrderValue, language: c.language },
      create: c,
    })
    console.log(`  ✅ ${c.countryCode}`)
  }
  console.log(`\n✅ Seed terminé — ${COUNTRIES.length} pays insérés/mis à jour.`)
}

main()
  .catch(e => { console.error('❌ Seed échoué :', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
