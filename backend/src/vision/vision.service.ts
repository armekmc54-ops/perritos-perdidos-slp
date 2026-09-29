import { Injectable, Logger } from '@nestjs/common';
import { Species } from '@prisma/client';

export interface ExtractedPetMetadata {
  species: Species;
  breed?: string | null;
  primaryColor?: string | null;
  size?: 'PEQUEÑO' | 'MEDIANO' | 'GRANDE' | null;
  aiTags: string[];
  confidence?: string;
  source: 'GEMINI_AI' | 'HEURISTIC_LOCAL';
}

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  /**
   * Analiza una fotografía y descripción para extraer metadatos estructurados
   * (Especie, Raza, Color principal, Tamaño y Etiquetas descriptivas).
   * Utiliza la API Gratuita de Google Gemini 1.5 Flash si está configurada,
   * con fallback automático a un motor heurístico local sin costo alguno.
   */
  async analyzePetImage(
    mediaUrl?: string | null,
    textContext?: { title?: string; description?: string; petName?: string; userSelectedSpecies?: Species },
  ): Promise<ExtractedPetMetadata> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && mediaUrl && (mediaUrl.startsWith('http') || mediaUrl.startsWith('data:image'))) {
      try {
        const aiResult = await this.callGeminiVision(apiKey, mediaUrl, textContext);
        if (aiResult) {
          return aiResult;
        }
      } catch (err: any) {
        this.logger.warn(`Fallo al consultar Gemini Vision API: ${err.message}. Usando fallback heurístico local.`);
      }
    }

    // Fallback gratuito garantizado: análisis semántico y heurístico local
    return this.fallbackHeuristicAnalysis(mediaUrl, textContext);
  }

  /**
   * Consulta al modelo Gemini 1.5 Flash mediante REST API (Free Tier: 15 req/min, 1,500 req/día gratuito)
   */
  private async callGeminiVision(
    apiKey: string,
    mediaUrl: string,
    context?: { title?: string; description?: string; petName?: string; userSelectedSpecies?: Species },
  ): Promise<ExtractedPetMetadata | null> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `
Actúa como un experto veterinario y clasificador de fauna doméstica.
Analiza la siguiente imagen de una mascota/animal en San Luis Potosí y el contexto de reporte: "${context?.title || ''} - ${context?.description || ''}".
Extrae obligatoriamente en formato JSON válido con la siguiente estructura exacta:
{
  "species": "DOG" | "CAT" | "BIRD" | "RABBIT" | "OTHER",
  "breed": "nombre aproximado de la raza o 'Mestizo' o null",
  "primaryColor": "color principal (ej. Negro, Blanco, Café, Dorado, Gris, Manchado)",
  "size": "PEQUEÑO" | "MEDIANO" | "GRANDE",
  "aiTags": ["etiqueta1", "etiqueta2", "etiqueta3", "señas_particulares"]
}
Responde ÚNICAMENTE con el bloque JSON sin texto explicativo.`;

    let parts: any[] = [{ text: promptText }];

    // Si es data:image en base64
    if (mediaUrl.startsWith('data:image')) {
      const match = mediaUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    } else if (mediaUrl.startsWith('http')) {
      // Para URLs remotas, se puede descargar o solicitar con contexto
      parts.push({ text: `URL de la fotografía del animal: ${mediaUrl}` });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(`Gemini API respondió con status ${response.status}`);
        return null;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      const validSpecies = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'];
      const species: Species = validSpecies.includes(parsed.species)
        ? (parsed.species as Species)
        : context?.userSelectedSpecies || Species.DOG;

      return {
        species,
        breed: parsed.breed || null,
        primaryColor: parsed.primaryColor || null,
        size: ['PEQUEÑO', 'MEDIANO', 'GRANDE'].includes(parsed.size) ? parsed.size : 'MEDIANO',
        aiTags: Array.isArray(parsed.aiTags) ? parsed.aiTags.map((t: string) => t.toLowerCase().trim()) : [],
        confidence: 'Alta (Gemini 1.5 Flash)',
        source: 'GEMINI_AI',
      };
    } catch (e: any) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  /**
   * Extractor Heurístico Local Gratuito (Sin dependencia de servicios externos)
   * Analiza textos, títulos y nombres para clasificar especie, color, tamaño y raza.
   */
  private fallbackHeuristicAnalysis(
    mediaUrl?: string | null,
    context?: { title?: string; description?: string; petName?: string; userSelectedSpecies?: Species },
  ): ExtractedPetMetadata {
    const fullText = `${context?.title || ''} ${context?.description || ''} ${context?.petName || ''}`.toLowerCase();

    // 1. Detectar Especie
    let species: Species = context?.userSelectedSpecies || Species.DOG;
    if (!context?.userSelectedSpecies) {
      if (/\b(gato|gatita|gatito|minino|felino|michi)\b/i.test(fullText)) {
        species = Species.CAT;
      } else if (/\b(ave|loro|perico|canario|pajaro|ninfa|cotorro)\b/i.test(fullText)) {
        species = Species.BIRD;
      } else if (/\b(conejo|conejita|conejito|liebre)\b/i.test(fullText)) {
        species = Species.RABBIT;
      } else if (/\b(perro|perrita|perrito|canino|lomito|cachorro)\b/i.test(fullText)) {
        species = Species.DOG;
      }
    }

    // 2. Detectar Color Principal
    let primaryColor: string | null = null;
    const colors = [
      { name: 'Negro', regex: /\b(negro|negrita|azabache|prieto)\b/i },
      { name: 'Blanco', regex: /\b(blanco|blanquito|güero)\b/i },
      { name: 'Café', regex: /\b(café|cafe|marrón|chocolate|canela)\b/i },
      { name: 'Dorado', regex: /\b(dorado|rubio|miel|amarillo)\b/i },
      { name: 'Gris', regex: /\b(gris|cenizo|plata)\b/i },
      { name: 'Manchado', regex: /\b(manchas|manchado|bicolor|tricolor)\b/i },
      { name: 'Atigrado', regex: /\b(atigrado|barcino)\b/i },
    ];
    for (const c of colors) {
      if (c.regex.test(fullText)) {
        primaryColor = c.name;
        break;
      }
    }

    // 3. Detectar Tamaño
    let size: 'PEQUEÑO' | 'MEDIANO' | 'GRANDE' = 'MEDIANO';
    if (/\b(pequeño|chico|chiquito|mini|toy|enano|cachorro)\b/i.test(fullText)) {
      size = 'PEQUEÑO';
    } else if (/\b(grande|gigante|enorme|alto|robusto)\b/i.test(fullText)) {
      size = 'GRANDE';
    }

    // 4. Detectar Raza Aproximada
    let breed: string | null = null;
    const breeds = [
      'Golden Retriever', 'Labrador', 'Chihuahua', 'Pastor Alemán', 'Husky',
      'Pitbull', 'Pug', 'Schnauzer', 'Poodle', 'Bulldog', 'Dálmata', 'Siamés',
      'Persa', 'Angora', 'Bengala', 'Holandés enano', 'Cabeza de León',
    ];
    for (const b of breeds) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(fullText)) {
        breed = b;
        break;
      }
    }
    if (!breed) {
      breed = species === Species.DOG ? 'Mestizo' : species === Species.CAT ? 'Doméstico' : null;
    }

    // 5. Construir Etiquetas IA
    const tags: string[] = [
      `especie-${species.toLowerCase()}`,
      `tamaño-${size.toLowerCase()}`,
    ];
    if (primaryColor) tags.push(`color-${primaryColor.toLowerCase()}`);
    if (breed) tags.push(`raza-${breed.toLowerCase().replace(/\s+/g, '-')}`);
    if (/\b(collar|placa|rojo|azul|cascabel|arnés)\b/i.test(fullText)) {
      tags.push('accesorio-identificado');
    }

    return {
      species,
      breed,
      primaryColor,
      size,
      aiTags: tags,
      confidence: 'Heurístico Local (Sin Costo)',
      source: 'HEURISTIC_LOCAL',
    };
  }
}
