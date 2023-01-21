import fs from 'fs';

try {
    const dotfile = new URL('.env', import.meta.url);

    fs.accessSync(dotfile);

    Object.assign(process.env, JSON.parse(fs.readFileSync(dotfile)));
    console.log('ok - .env file loaded');
} catch (err) {
    console.log('ok - no .env file loaded');
}

export default class Task {
    constructor() {
        this.token = process.env.COTRIP_TOKEN;
        this.api = 'https://data.cotrip.org/';

        this.etl = {
            api: process.env.ETL_API,
            layer: process.env.ETL_LAYER,
            token: process.env.ETL_TOKEN
        };

        if (!this.token) throw new Error('No COTrip API Token Provided');
        if (!this.etl.api) throw new Error('No ETL API URL Provided');
        if (!this.etl.layer) throw new Error('No ETL Layer Provided');
        if (!this.etl.token) throw new Error('No ETL Token Provided');
    }

    async control() {
        const plows = [];
        let batch = -1;
        let res;
        do {
            console.log(`ok - fetching ${++batch} of plows`);
            const url = new URL('/api/v1/snowPlows', this.api);
            url.searchParams.append('apiKey', this.token);
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

        const post = await fetch(new URL(`/api/layer/${this.etl.layer}/cot`, this.etl.api), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.etl.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(features)
        });

        if (!post.ok) {
            console.error(await post.text());
            throw new Error('Failed to post layer to ETL');
        } else {
            console.log(await post.json());
        }
    }
}

export async function handler() {
    const task = new Task();
    await task.control();
}

if (import.meta.url === `file://${process.argv[1]}`) handler();


