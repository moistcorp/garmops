export type SizeRow = {
  size: string
  chest?: string
  length?: string
  shoulder?: string
  waist?: string
  inseam?: string
  sleeve?: string
  handles?: string
}

export type SizeChart = {
  sizes: SizeRow[]
  note?: string
  fitNote?: string
  chestLabel?: string
  lengthLabel?: string
}

export const SIZE_CHARTS: Record<string, SizeChart> = {
  'regular-tee': {
    note: 'All measurements are in inches and follow the approved Regular T-Shirt size chart.',
    sizes: [
      { size: 'XS', length: '25"', shoulder: '16"', chest: '36"', sleeve: '8"' },
      { size: 'S', length: '25.5"', shoulder: '16.5"', chest: '38"', sleeve: '8.5"' },
      { size: 'M', length: '26"', shoulder: '17"', chest: '40"', sleeve: '9"' },
      { size: 'L', length: '27"', shoulder: '17.5"', chest: '42"', sleeve: '9.5"' },
      { size: 'XL', length: '28"', shoulder: '18"', chest: '44"', sleeve: '10"' },
    ],
  },
  'boxy-tee': {
    note: 'All measurements are in inches and follow the approved Boxy T-Shirt size chart.',
    sizes: [
      { size: 'XS', length: '27"', shoulder: '17.5"', chest: '20"', sleeve: '8"' },
      { size: 'S', length: '27.5"', shoulder: '18.25"', chest: '21"', sleeve: '8.5"' },
      { size: 'M', length: '28"', shoulder: '19"', chest: '22"', sleeve: '9"' },
      { size: 'L', length: '29"', shoulder: '19.75"', chest: '23"', sleeve: '9.5"' },
      { size: 'XL', length: '30"', shoulder: '20.5"', chest: '24"', sleeve: '10"' },
    ],
  },
  'longsleeve': {
    fitNote: 'Regular straight-cut fit',
    note: 'Chest measurements are in inches and follow the supplied Full Sleeve T-Shirt size guide.',
    sizes: [
      { size: 'S', chest: '38"' },
      { size: 'M', chest: '40"' },
      { size: 'L', chest: '42"' },
      { size: 'XL', chest: '46"' },
      { size: 'XXL', chest: '50"' },
    ],
  },
  'regular-sweatshirt': {
    note: 'All measurements are in inches and follow the approved Sweatshirt size chart.',
    sizes: [
      { size: 'S', length: '25.5"', shoulder: '18.5"', chest: '43"', sleeve: '25"' },
      { size: 'M', length: '26"', shoulder: '19"', chest: '45"', sleeve: '25.5"' },
      { size: 'L', length: '26.5"', shoulder: '19.5"', chest: '47"', sleeve: '26"' },
      { size: 'XL', length: '27"', shoulder: '20"', chest: '49"', sleeve: '26.5"' },
      { size: 'XXL', length: '27.5"', shoulder: '20.5"', chest: '51"', sleeve: '27"' },
    ],
  },
  'regular-hoodie': {
    note: 'All measurements are in inches and follow the approved Hoodie size chart.',
    sizes: [
      { size: 'S', length: '25.5"', shoulder: '18.5"', chest: '43"', sleeve: '25"' },
      { size: 'M', length: '26"', shoulder: '19"', chest: '45"', sleeve: '25.5"' },
      { size: 'L', length: '26.5"', shoulder: '19.5"', chest: '47"', sleeve: '26"' },
      { size: 'XL', length: '27"', shoulder: '20"', chest: '49"', sleeve: '26.5"' },
      { size: 'XXL', length: '27.5"', shoulder: '20.5"', chest: '51"', sleeve: '27"' },
    ],
  },
  'tote': {
    note: 'One size. Measurements are in centimetres.',
    chestLabel: 'Width',
    lengthLabel: 'Height',
    sizes: [
      { size: 'One Size', chest: '38 cm', length: '42 cm', handles: '24"' },
    ],
  },
}

export const PRODUCT_SIZE_CHART_MAP: Record<string, string> = {
  'regular-fit-tee-200gsm': 'regular-tee',
  'boxy-fit-tee-200gsm': 'boxy-tee',
  'regular-fit-tee-260gsm': 'regular-tee',
  'boxy-fit-tee-260gsm': 'boxy-tee',
  'longsleeve-tee-260gsm': 'longsleeve',
  'regular-fit-sweatshirt-320gsm': 'regular-sweatshirt',
  'regular-fit-hoodie-320gsm': 'regular-hoodie',
  'canvas-tote-bag': 'tote',
}

export function getSizeChart(slug: string): SizeChart | null {
  const key = PRODUCT_SIZE_CHART_MAP[slug]
  return key ? SIZE_CHARTS[key] ?? null : null
}
