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

function incrementIP(ip: string): string {
    const octets = ip.split('.').map(Number);
    for (let i = octets.length - 1; i >= 0; i--) {
        if (octets[i] < 255) {
            octets[i]++;
            break;
        } else {
            octets[i] = 0;
        }
    }
    return octets.join('.');
}

function decrementIP(ip: string): string {
    const octets = ip.split('.').map(Number);
    for (let i = octets.length - 1; i >= 0; i--) {
        if (octets[i] > 0) {
            octets[i]--;
            break;
        } else {
            octets[i] = 255;
        }
    }
    return octets.join('.');
}

export async function processIPv4(ipWithCidr: string): Promise<IPResult> {
    try {
        const address = new Address4(ipWithCidr);
        if (!Address4.isValid(ipWithCidr)) {
            throw new Error('Adresse IP invalide');
        }

        const cidr = parseInt(ipWithCidr.split('/')[1]);
        const subnetMask = cidrToSubnetMask(cidr);

        const networkAddress = address.startAddress().address;
        const broadcastAddress = address.endAddress().address;

        const firstUsable = incrementIP(networkAddress);
        const lastUsable = decrementIP(broadcastAddress);

        return {
            ip: ipWithCidr,
            network: networkAddress,
            subnetMask: subnetMask,
            firstUsable: firstUsable,
            lastUsable: lastUsable,
            gateway: lastUsable,
            broadcast: broadcastAddress,
            site: ''
        };
    } catch (error) {
        console.error(error);
        throw new Error(`Erreur lors du traitement de l'IP ${ipWithCidr}`);
    }
}