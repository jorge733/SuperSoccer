// Relato en pantalla con modismos chilenos.
const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];

const FRASES = {
  gol: ['¡GOOOOOL! ¡Qué golazo!', '¡GOOOL! ¡La metió en el ángulo!', '¡GOOOOL! ¡Se cayó el estadio!', '¡GOOOL! ¡Es un crack!', '¡GOOOOOOL! ¡Pa’ la casa!', '¡GOOOL! ¡Qué manera de definir!'],
  golPropio: ['¡Autogol! ¡Qué mala cueva!', '¡En contra! ¡Se la mandó a su propio arco!'],
  atajada: ['¡Tremenda atajada!', '¡La sacó el arquero!', '¡Qué manera de volar!', '¡Atajadón!', '¡Se la sacó del ángulo!'],
  palo: ['¡Uyyy, en el palo!', '¡El palo le dijo que no!', '¡Pegó en el horizontal!'],
  fuera: ['¡Por poquito!', '¡Se fue rozando el palo!', '¡Uf, casi!', '¡Ay, estaba para el gol!'],
  fueraLejos: ['¡Se la comió!', '¡A las nubes!', '¡Fue a buscar a la galería!', '¡Mandó el balón a Mendoza!'],
  falta: ['¡Falta!', '¡Lo bajó!', '¡Pobrecito, le pegaron!', '¡Qué patada, compadre!'],
  amarilla: ['¡Tarjeta amarilla!', '¡Amonestado!'],
  roja: ['¡Roja directa! ¡A las duchas!', '¡Expulsado!'],
  offside: ['¡Fuera de juego!', '¡Estaba adelantado!', '¡Offside, levantó la bandera!'],
  corner: ['Tiro de esquina', 'Córner'],
  penal: ['¡PENAL! ¡Cobró penal!', '¡Penal, penal, penal!'],
  barrida: ['¡Qué quite!', '¡Barrida limpia!', '¡Le sacó la pelota con todo!'],
  regate: ['¡Lo dejó parado!', '¡Qué jugada!', '¡Se lo comió con un amague!', '¡Lo dejó pagando!'],
  ocasion: ['¡Ojo que viene!', '¡Peligro!', '¡Llega con todo!'],
  inicio: ['¡Comienza el partido!', '¡Rueda el balón!'],
  entretiempo: ['Final del primer tiempo', '¡Al descanso!'],
  final: ['¡Final del partido!', '¡Se acabó!', '¡Pitazo final!'],
  penalGol: ['¡Adentro!', '¡No perdonó!', '¡Gol! ¡Lo abrió al palo!'],
  penalAtajado: ['¡LO ATAJÓ!', '¡Atajadón del arquero!'],
  penalFuera: ['¡Lo botó!', '¡Afuera! ¡Qué presión!'],
};

export function frase(tipo) {
  return azar(FRASES[tipo] || [tipo]);
}
