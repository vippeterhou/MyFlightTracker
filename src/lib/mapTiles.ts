import { env } from '$env/dynamic/public';

const cartoApiKey = encodeURIComponent(env.PUBLIC_CARTO_API_KEY ?? '');

export const MAP_TILES = {
	DEFAULT: {
		URL: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoApiKey}`,
		THUMBNAIL: `https://basemaps.cartocdn.com/rastertiles/voyager/2/1/1.png?key=${cartoApiKey}`,
		ATTRIBUTION: '© OpenStreetMap contributors © CARTO',
		MAX_ZOOM: 19,
	},
	TERRAIN: {
		URL: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
		THUMBNAIL: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/2/1/1',
		ATTRIBUTION: 'Tiles © Esri',
		MAX_ZOOM: 19,
	},
	SATELLITE: {
		URL: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		THUMBNAIL: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/2/1/1',
		ATTRIBUTION: 'Tiles © Esri',
		MAX_ZOOM: 19,
	},
} as const;
