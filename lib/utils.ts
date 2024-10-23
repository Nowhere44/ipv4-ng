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

        // Parse l'IP et le CIDR
        const [inputIP, cidrStr] = ipWithCidr.split('/');
        const cidr = parseInt(cidrStr);
        const subnetMask = cidrToSubnetMask(cidr);

        // Calcul des adresses du réseau
        const networkAddress = address.startAddress().address;
        const broadcastAddress = address.endAddress().address;

        // Variables qui peuvent être modifiées
        let firstUsable = incrementIP(networkAddress);
        const lastUsable = decrementIP(broadcastAddress);
        let gateway = lastUsable;

        // Le reste des constantes
        const inputOctets = inputIP.split('.').map(Number);
        const networkOctets = networkAddress.split('.').map(Number);
        const broadcastOctets = broadcastAddress.split('.').map(Number);

        const compareIP = (ip1: number[], ip2: number[]): number => {
            for (let i = 0; i < 4; i++) {
                if (ip1[i] !== ip2[i]) return ip1[i] - ip2[i];
            }
            return 0;
        };

        const isInUsableRange = compareIP(inputOctets, networkOctets) > 0 &&
            compareIP(inputOctets, broadcastOctets) < 0;

        if (isInUsableRange) {
            const isSecondToLast = compareIP(inputOctets, decrementIP(broadcastAddress).split('.').map(Number)) === 0;
            if (isSecondToLast) {
                gateway = inputIP;
            }

            const isSecond = compareIP(inputOctets, incrementIP(firstUsable).split('.').map(Number)) === 0;
            if (isSecond) {
                firstUsable = inputIP;
            }
        }

        // On retourne un nouvel objet avec toutes les valeurs
        return {
            ip: ipWithCidr,
            network: networkAddress,
            subnetMask: subnetMask,
            firstUsable: firstUsable,
            lastUsable: lastUsable,
            gateway: gateway,
            broadcast: broadcastAddress,
            site: ''
        };
    } catch (error) {
        console.error(error);
        throw new Error(`Erreur lors du traitement de l'IP ${ipWithCidr}`);
    }
}