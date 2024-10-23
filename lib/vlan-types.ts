export interface DeviceForVLAN {
    id: string;
    name: string;
    type: DeviceType;
    currentVlan?: number;
    zone?: string;
    site?: string;
    network?: string;  // Ajout de la propriété network
}

export interface SubnetReorganization {
    originalSubnet: string;
    newSubnet: string;
    deviceCount: number;
    vlan: number;
    devices: DeviceForVLAN[];
    reason?: string;
    capacityInfo?: {
        total: number;
        used: number;
        available: number;
    };
}

export interface NetworkTransition {
    currentClass: 'A' | 'B' | 'C';
    suggestedClass: 'A' | 'B' | 'C';
    reason: string;
    requiredHosts: number;
    maxHosts: number;
}

// Assurons-nous que DeviceType inclut tous les types possibles
export type DeviceType =
    | 'pc'
    | 'printer'
    | 'workstation'
    | 'wifi'
    | 'wireless'
    | 'phone'
    | 'voip'
    | 'camera'
    | 'surveillance'
    | 'server'
    | 'iot'
    | 'sensor'
    | 'switch'
    | 'admin';

export interface VLANMigrationResult {
    device: DeviceForVLAN;
    suggestedVlan: StandardVLAN;
    hasConflict: boolean;
}

export interface StandardVLAN {
    id: number;
    name: string;
    description: string;
    maxDevices?: number;
    isExtension?: boolean;
    parentVlanId?: number;
}

export interface SubnetReorganization {
    originalSubnet: string;    // Sous-réseau actuel
    newSubnet: string;        // Nouveau sous-réseau suggéré
    deviceCount: number;      // Nombre d'appareils
    vlan: number;            // VLAN suggéré
    devices: DeviceForVLAN[]; // Appareils concernés
    currentVlan?: number;     // VLAN actuel
    vlanName?: string;       // Nom du VLAN
}