import fs from 'fs';
import ETL from '@tak-ps/etl';

try {
    const dotfile = new URL('.env', import.meta.url);

    fs.accessSync(dotfile);

    Object.assign(process.env, JSON.parse(fs.readFileSync(dotfile)));
    console.log('ok - .env file loaded');
} catch (err) {
    console.log('ok - no .env file loaded');
}

export default class Task extends ETL {
    static schema() {
        return {
            type: 'object',
            required: ['COTRIP_TOKEN'],
            properties: {
                'COTRIP_TOKEN': {
                    type: 'string',
                    description: 'API Token for CoTrip'
                },
                'DEBUG': {
                    type: 'boolean',
                    default: false,
                    description: 'Print GeoJSON Features in logs'
                }
            }
        };
    }

    async control() {
        const layer = await this.layer();

        const api = 'https://data.cotrip.org/';
        if (!layer.data.environment.COTRIP_TOKEN) throw new Error('No COTrip API Token Provided');
        const token = layer.data.environment.COTRIP_TOKEN;

        const plows = [];
        let batch = -1;
        let res;
        do {
            console.log(`ok - fetching ${++batch} of plows`);
            const url = new URL('/api/v1/snowPlows', api);
            url.searchParams.append('apiKey', token);
            if (res) url.searchParams.append('offset', res.headers.get('next-offset'));

            res = await fetch(url);

            plows.push(...(await res.json()).features);
        } while (res.headers.has('next-offset') && res.headers.get('next-offset') !== 'None');
        console.log(`ok - fetched ${plows.length} plows`);

        const features = {
            type: 'FeatureCollection',
            features: plows.map((plow) => {
                const feat = {
                    id: plow.avl_location.vehicle.id2,
                    type: 'Feature',
                    properties: {
                        type: 'a-f-G-E-V-A-T-H',
                        how: 'm-g',
                        callsign: `${plow.avl_location.vehicle.fleet} ${plow.avl_location.vehicle.type}`
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            plow.avl_location.position.longitude,
                            plow.avl_location.position.latitude
                        ]
                    }
                };

                return feat;
            })
        };

        await this.submit(features);
    }
}

export async function handler(event = {}) {
    if (event.type === 'schema') {
        return Task.schema();
    } else {
        const task = new Task();
        await task.control();
    }

}

if (import.meta.url === `file://${process.argv[1]}`) handler();


