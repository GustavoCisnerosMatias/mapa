import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OverpassService {
  // GADM data via proxy local (evita CORS)
  // ADM1 = Provincias, ADM2 = Cantones
  private gadmUrl = '/gadm/gadm4.1/json/gadm41_ECU_2.json';
  
  // Cache de datos
  private cantonesData: any = null;
  private guayasData: any = null;

  // Los 24 cantones reales de Guayas (nombres como aparecen en geoBoundaries)
  private cantonesGuayas = [
    'Guayaquil',
    'Durán',
    'Samborondón',
    'Daule',
    'Milagro',
    'Naranjal',
    'Playas',
    'Yaguachi',
    'Balao',
    'Balzar',
    'Colimes',
    'El Empalme',
    'El Triunfo',
    'General Antonio Elizalde',
    'Isidro Ayora',
    'Lomas de Sargentillo',
    'Marcelino Maridueña',
    'Naranjito',
    'Nobol',
    'Palestina',
    'Pedro Carbo',
    'Salitre',
    'Santa Lucía',
    'Simón Bolívar'
  ];

  constructor(private http: HttpClient) {}

  /**
   * Carga los datos de GADM (cantones de Ecuador)
   */
  private async loadGeoBoundariesData(): Promise<any> {
    if (this.cantonesData) {
      return this.cantonesData;
    }

    console.log('📡 Conectando con GADM (UC Davis)...');
    
    // Descargar el GeoJSON de GADM - Universidad de California Davis
    const response = await firstValueFrom(
      this.http.get<any>(this.gadmUrl, { responseType: 'json' as any }).pipe(timeout(60000))
    );

    // GADM usa formato diferente, convertir a GeoJSON estándar
    this.cantonesData = {
      type: 'FeatureCollection',
      features: response.features || response
    };

    console.log(`✓ ${this.cantonesData.features.length} cantones de Ecuador cargados`);
    return this.cantonesData;
  }

  /**
   * Obtiene la provincia de Guayas (uniendo todos sus cantones)
   */
  async getGuayasProvince(): Promise<any> {
    try {
      console.log('🗺️ Obteniendo provincia de Guayas...');
      
      const allCantones = await this.loadGeoBoundariesData();
      
      // GADM usa NAME_1 para provincia (ADM1) y NAME_2 para cantón (ADM2)
      const guayasCantones = allCantones.features.filter((f: any) => {
        const province = f.properties?.NAME_1 || f.properties?.ADM1_ES || '';
        return province.toLowerCase().includes('guayas');
      });

      console.log(`✓ ${guayasCantones.length} cantones encontrados en Guayas`);

      // Crear un polígono envolvente de Guayas (usando el primer cantón como base)
      // En realidad usaremos el MultiPolygon de todos los cantones juntos
      if (guayasCantones.length > 0) {
        // Combinar todas las geometrías en un MultiPolygon
        const allCoords: any[] = [];
        guayasCantones.forEach((canton: any) => {
          if (canton.geometry.type === 'Polygon') {
            allCoords.push(canton.geometry.coordinates);
          } else if (canton.geometry.type === 'MultiPolygon') {
            allCoords.push(...canton.geometry.coordinates);
          }
        });

        this.guayasData = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { name: 'Guayas' },
            geometry: {
              type: 'MultiPolygon',
              coordinates: allCoords
            }
          }]
        };

        console.log('✓ Guayas cargado desde GADM');
        return this.guayasData;
      }

      throw new Error('No se encontraron cantones de Guayas');
    } catch (error) {
      console.error('Error cargando Guayas:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los cantones de Guayas
   */
  async getGuayasCantones(): Promise<any> {
    try {
      console.log('📡 Obteniendo cantones de Guayas...');
      
      const allCantones = await this.loadGeoBoundariesData();
      
      // GADM usa NAME_1 para provincia (ADM1) y NAME_2 para cantón (ADM2)
      const guayasCantones = allCantones.features.filter((f: any) => {
        const province = f.properties?.NAME_1 || '';
        return province.toLowerCase().includes('guayas');
      });

      // Mapear nombres usando NAME_2 de GADM
      const features = guayasCantones.map((f: any) => {
        const originalName = f.properties?.NAME_2 || f.properties?.name || 'Sin nombre';
        return {
          ...f,
          properties: {
            ...f.properties,
            name: originalName
          }
        };
      });

      console.log(`✓ ${features.length} cantones de Guayas cargados`);
      
      // Mostrar nombres encontrados
      features.forEach((f: any) => {
        console.log(`   ✓ ${f.properties.name}: ${f.geometry.type}`);
      });

      return {
        type: 'FeatureCollection',
        features: features
      };
    } catch (error) {
      console.error('Error cargando cantones:', error);
      throw error;
    }
  }

  /**
   * Obtiene un cantón específico por nombre
   */
  async getCantonByName(cantonName: string): Promise<any> {
    try {
      const allCantones = await this.getGuayasCantones();
      
      const canton = allCantones.features.find((f: any) => {
        const name = f.properties?.name || '';
        return name.toLowerCase().includes(cantonName.toLowerCase()) ||
               cantonName.toLowerCase().includes(name.toLowerCase());
      });

      if (canton) {
        return {
          type: 'FeatureCollection',
          features: [canton]
        };
      }

      throw new Error(`${cantonName} no encontrado`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtiene lista de nombres de cantones disponibles
   */
  getCantonesNames(): string[] {
    return this.cantonesGuayas;
  }
}
