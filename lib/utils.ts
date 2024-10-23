import { Address4 } from 'ip-address'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { IPResult } from './types'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

function cidrToSubnetMask(cidr: number): string {
    const mask = [];
    for (let i = 0; i < 4; i++) {
        const n = Math.min(cidr, 8);
        mask.push(256 - (256 >> n));
        cidr -= n;
    }
    return mask.join('.');
}

export async function processIPv4(ipWithCidr: string): Promise<IPResult> {
    try {
        const address = new Address4(ipWithCidr);
        if (!Address4.isValid(ipWithCidr)) {
            throw new Error('Adresse IP invalide');
        }

        // Extraire le CIDR et convertir en notation décimale
        const cidr = parseInt(ipWithCidr.split('/')[1]);
        const subnetMask = cidrToSubnetMask(cidr);

        const lastUsable = address.endAddress().address;

        return {
            ip: ipWithCidr,
            network: address.startAddress().address,
            subnetMask: subnetMask, // Maintenant en notation décimale pointée
            firstUsable: address.startAddress().address,
            lastUsable: lastUsable,
            gateway: lastUsable,
            broadcast: address.endAddress().address,
            site: ''
        };
    } catch (error) {
        console.error(error);
        throw new Error(`Erreur lors du traitement de l'IP ${ipWithCidr}`);
    }
}
