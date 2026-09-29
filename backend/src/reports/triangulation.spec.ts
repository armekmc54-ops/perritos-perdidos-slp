import { TriangulationService } from './triangulation.service';
import { Species } from '@prisma/client';

function runTests() {
  console.log('🧪 Iniciando Suite de Pruebas: Motor Espacial y Triangulación...');
  const service = new TriangulationService();

  // Test 1: Comprobación de parámetros de especies
  console.log('➡️ Test 1: Configuración de especies...');
  const dogConfig = service.getSpeciesConfig(Species.DOG);
  const catConfig = service.getSpeciesConfig(Species.CAT);
  const birdConfig = service.getSpeciesConfig(Species.BIRD);

  if (dogConfig.speedKmH <= catConfig.speedKmH) {
    throw new Error('Fallo: La velocidad de perro debe ser mayor a la de gato');
  }
  if (birdConfig.speedKmH <= dogConfig.speedKmH) {
    throw new Error('Fallo: La velocidad de ave debe ser mayor a la de perro');
  }
  console.log('   ✅ Configuración de especies correcta.');

  // Test 2: Triangulación con perro vs gato tras 6 horas
  console.log('➡️ Test 2: Comparativa de dispersión Perro vs Gato a las 6 horas...');
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const dogReport = {
    id: 'report-dog',
    species: Species.DOG,
    latitude: 22.1565,
    longitude: -100.9855,
    createdAt: sixHoursAgo,
    title: 'Perro extraviado en Tangamanga',
    petName: 'Max',
  };

  const catReport = {
    id: 'report-cat',
    species: Species.CAT,
    latitude: 22.1565,
    longitude: -100.9855,
    createdAt: sixHoursAgo,
    title: 'Gatito extraviado en Carranza',
    petName: 'Misi',
  };

  const dogTriangulation = service.calculateTriangulation(dogReport);
  const catTriangulation = service.calculateTriangulation(catReport);

  console.log(`   🐶 Radio Perro (6h): ${dogTriangulation.searchRadiusMeters} metros (Área: ${dogTriangulation.searchAreaSquareKm} km²)`);
  console.log(`   🐱 Radio Gato (6h): ${catTriangulation.searchRadiusMeters} metros (Área: ${catTriangulation.searchAreaSquareKm} km²)`);

  if (dogTriangulation.searchRadiusMeters <= catTriangulation.searchRadiusMeters) {
    throw new Error('Fallo: El radio de búsqueda de perro debe ser significativamente mayor al de gato');
  }
  console.log('   ✅ Modelo de dispersión biológica verificado.');

  // Test 3: Límite de saturación biológica (Max Radius)
  console.log('➡️ Test 3: Límite de saturación biológica tras 1 mes...');
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oldDogReport = { ...dogReport, createdAt: oneMonthAgo };
  const oldDogTriangulation = service.calculateTriangulation(oldDogReport);

  if (oldDogTriangulation.searchRadiusMeters > dogConfig.maxRadiusMeters) {
    throw new Error(`Fallo: El radio superó el límite biológico máximo (${oldDogTriangulation.searchRadiusMeters} > ${dogConfig.maxRadiusMeters})`);
  }
  console.log(`   ✅ Radio contenido en límite máximo biológico: ${oldDogTriangulation.searchRadiusMeters} m.`);

  // Test 4: Secuencia de avistamientos y re-centrado de ancla
  console.log('➡️ Test 4: Ruta cronológica y desplazamiento de ancla por avistamiento...');
  const sightings = [
    {
      id: 'sighting-1',
      latitude: 22.158,
      longitude: -100.982,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      description: 'Visto por el parque',
    },
    {
      id: 'sighting-2',
      latitude: 22.162,
      longitude: -100.978,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Más reciente
      description: 'Visto cruzando la avenida',
    },
  ];

  const routeTriangulation = service.calculateTriangulation(dogReport, sightings);
  if (!routeTriangulation.anchorPoint.isLastSighting || routeTriangulation.anchorPoint.sightingId !== 'sighting-2') {
    throw new Error('Fallo: El ancla de búsqueda debe ser el último avistamiento cronológico');
  }
  if (routeTriangulation.pathPoints.length !== 3) {
    throw new Error('Fallo: La ruta debe contener origen + 2 avistamientos');
  }
  console.log('   ✅ Ancla centrada en el último avistamiento y trazado de ruta verificado.');

  // Test 5: Prueba de Estrés (Benchmark 1,000 cálculos de triangulación espacial)
  console.log('➡️ Test 5: Benchmark de estrés (1,000 triangulaciones concurrentes)...');
  const tStart = performance.now();
  for (let i = 0; i < 1000; i++) {
    service.calculateTriangulation(dogReport, sightings);
  }
  const tEnd = performance.now();
  const totalMs = (tEnd - tStart).toFixed(2);
  console.log(`   ⚡ 1,000 triangulaciones calculadas en: ${totalMs} ms (Promedio: ${(Number(totalMs) / 1000).toFixed(4)} ms/op)`);

  if (Number(totalMs) > 200) {
    throw new Error(`Alerta de rendimiento: Tomó ${totalMs}ms, excediendo el umbral óptimo de 200ms`);
  }
  console.log('   ✅ Rendimiento geoespacial de ultra alta velocidad verificado (<0.2 ms por cálculo).');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS ESPACIALES PASARON SATISFACTORIAMENTE!\n');
}

runTests();
