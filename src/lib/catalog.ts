// Salon staff and services. Durations are first estimates — adjust here.

export type StaffId = 'sanja' | 'nina'
/** 'nokti' is the main room (both can work there at once); 'soba' is the
 *  shared pedicure/massage room, which fits one client at a time. */
export type Room = 'nokti' | 'soba'

export const STAFF: { id: StaffId; name: string }[] = [
  { id: 'sanja', name: 'Sanja' },
  { id: 'nina', name: 'Nina' },
]

export type Service = {
  id: string
  name: string
  group: string
  durationMin: number
  room: Room
  staff: StaffId[]
}

const BOTH: StaffId[] = ['sanja', 'nina']
const SANJA: StaffId[] = ['sanja']

const s = (group: string, room: Room, staff: StaffId[], items: [string, string, number][]): Service[] =>
  items.map(([id, name, durationMin]) => ({ id, name, group, durationMin, room, staff }))

export const SERVICES: Service[] = [
  ...s('Nokti', 'nokti', BOTH, [
    ['manikir', 'Manikir', 30],
    ['trajni-lak-ruke', 'Trajni lak ruke', 45],
    ['gel-sm', 'Gel na prirodne nokte – S i M', 75],
    ['gel-l', 'Gel na prirodne nokte – L', 90],
    ['gel-xl', 'Gel na prirodne nokte – XL', 105],
    ['nadogradnja-sm', 'Nadogradnja – S i M', 120],
    ['nadogradnja-l', 'Nadogradnja – L', 135],
    ['nadogradnja-xl', 'Nadogradnja – XL', 150],
    ['refresh', 'Refresh / mini korekcija', 60],
    ['skidanje-gela', 'Skidanje gela', 20],
    ['skidanje-laka-ruke', 'Skidanje trajnog laka ruke', 15],
    ['lakiranje', 'Lakiranje noktiju', 15],
    ['parafin', 'Parafin ruku', 15],
  ]),
  ...s('Pedikir', 'soba', BOTH, [
    ['pedikir', 'Pedikir', 60],
    ['trajni-lak-noge', 'Trajni lak noge', 45],
    ['pedikir-lak', 'Pedikir + trajni lak noge', 90],
    ['skidanje-laka-noge', 'Skidanje trajnog laka noge', 15],
  ]),
  ...s('Masaže', 'soba', SANJA, [
    ['masaza-parcijalna', 'Parcijalna masaža relax', 30],
    ['masaza-tijelo', 'Masaža cijelog tijela', 60],
    ['sportska', 'Sportska masaža', 30],
    ['sportska-tijelo', 'Sportska masaža cijelo tijelo', 60],
    ['masaza-ruku', 'Masaža ruku', 15],
    ['masaza-stopala', 'Masaža stopala', 20],
    ['madero-tijelo', 'Maderoterapija – cijelo tijelo', 60],
    ['madero-noge', 'Maderoterapija – noge', 40],
    ['madero-ruke', 'Maderoterapija – ruke', 30],
    ['madero-stomak', 'Maderoterapija – stomak', 30],
    ['anticelulit', 'Anticelulit masaža parcijalna', 45],
  ]),
  ...s('Depilacija', 'soba', SANJA, [
    ['depilacija-noge', 'Depilacija nogu', 45],
    ['depilacija-pola', 'Depilacija do pola nogu', 30],
    ['depilacija-ruke', 'Depilacija ruku', 20],
    ['depilacija-ledja', 'Depilacija leđa', 20],
    ['depilacija-prsa', 'Depilacija prsa', 20],
    ['depilacija-stomak', 'Depilacija stomaka', 15],
    ['depilacija-nausnice', 'Depilacija nausnica', 10],
  ]),
  ...s('Obrve', 'nokti', SANJA, [
    ['korekcija-obrva', 'Korekcija obrva', 15],
    ['farbanje-obrva', 'Farbanje obrva', 20],
  ]),
]

/** Free-text service with a duration chosen when booking. */
export const OTHER_SERVICE_ID = 'ostalo'

export const findService = (id: string) => SERVICES.find((x) => x.id === id)

export const servicesFor = (staffId: StaffId) => SERVICES.filter((x) => x.staff.includes(staffId))

export const staffName = (id: StaffId) => STAFF.find((x) => x.id === id)?.name ?? id
