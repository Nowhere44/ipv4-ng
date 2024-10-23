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

function ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

export async function processIPv4(ipWithCidr: string): Promise<IPResult> {
    try {
        const address = new Address4(ipWithCidr);
        if (!Address4.isValid(ipWithCidr)) {
            throw new Error('Adresse IP invalide');
        }

        const [inputIP, cidrStr] = ipWithCidr.split('/') || ipWithCidr.split(' /');
        const cidr = parseInt(cidrStr);
        const subnetMask = cidrToSubnetMask(cidr);

        const networkAddress = address.startAddress().address;
        const broadcastAddress = address.endAddress().address;

        let firstUsable = incrementIP(networkAddress);
        const lastUsable = decrementIP(broadcastAddress);
        let gateway = lastUsable;

        const inputIPInt = ipToInt(inputIP);
        const networkInt = ipToInt(networkAddress);

        const firstUsableInt = ipToInt(firstUsable);
        const lastUsableInt = ipToInt(lastUsable);

        const totalUsableIPs = lastUsableInt - firstUsableInt + 1;
        const midpointUsableInt = firstUsableInt + Math.floor((totalUsableIPs - 1) / 2);

        const isInUsableRange = inputIPInt >= firstUsableInt && inputIPInt <= lastUsableInt;

        if (inputIPInt === networkInt) {
            // L'adresse saisie est l'adresse du réseau, on ne change rien
        } else if (isInUsableRange) {
            // L'adresse saisie est une adresse de machine dans la plage utilisable
            if (inputIPInt <= midpointUsableInt) {
                // Si l'adresse est dans la première moitié des adresses utilisables
                firstUsable = inputIP;
            } else {
                // Si l'adresse est dans la seconde moitié des adresses utilisables
                gateway = inputIP;
            }
        }
        // Sinon, si l'adresse n'est pas dans la plage utilisable, on ne change rien

        return {
            ip: ipWithCidr,
            network: networkAddress,
            subnetMask: subnetMask,
            gateway: gateway,
            firstUsable: firstUsable,
            lastUsable: lastUsable,
            broadcast: broadcastAddress,
            site: ''
        };
    } catch (error) {
        console.error(error);
        throw new Error(`Erreur lors du traitement de l'IP ${ipWithCidr}`);
    }
}