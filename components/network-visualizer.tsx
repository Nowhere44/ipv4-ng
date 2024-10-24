import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SubnetResult {
    network: string;
    mask: string;
    firstIP: string;
    lastIP: string;
    broadcast: string;
    size: number;
}

interface NetworkVisualizerProps {
    results: SubnetResult[];
    baseIP: string;
}

const NetworkVisualizer = ({ results, baseIP }: NetworkVisualizerProps) => {
    // Calculer la taille totale pour les proportions
    const totalSize = results.reduce((sum, result) => sum + result.size, 0);

    // Générer une couleur basée sur la taille du réseau
    const getNetworkColor = (size: number, index: number) => {
        const hue = (index * 137.5) % 360; // Nombre d'or pour une bonne distribution
        const saturation = 65 + (size / totalSize) * 20;
        const lightness = 55;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    // Formater la taille pour l'affichage
    const formatSize = (size: number) => {
        if (size >= 1000) {
            return `${(size / 1000).toFixed(1)}k`;
        }
        return size.toString();
    };

    return (
        <Card className="w-full">
            <CardContent className="pt-6">
                <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500">Réseau de base: {baseIP}</h3>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="text-xs text-gray-500">
                            Échelle:
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-2 bg-blue-500" /> = 256 hôtes
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="h-[400px] border rounded-lg p-4">
                    <div className="space-y-6">
                        {results.map((result, index) => (
                            <TooltipProvider key={index}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="relative">
                                            {/* Barre de progression du réseau */}
                                            <div
                                                className="h-12 rounded-md relative overflow-hidden transition-all hover:shadow-md cursor-pointer"
                                                style={{
                                                    width: `${(result.size / totalSize) * 100}%`,
                                                    minWidth: '100px',
                                                    backgroundColor: getNetworkColor(result.size, index)
                                                }}
                                            >
                                                {/* Informations de base */}
                                                <div className="absolute inset-0 px-3 flex items-center justify-between text-white">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm">{result.network}</span>
                                                        <span className="text-xs opacity-75">{result.mask}</span>
                                                    </div>
                                                    <span className="text-xs font-medium">
                                                        {formatSize(result.size)} hôtes
                                                    </span>
                                                </div>

                                                {/* Indicateur de taille relative */}
                                                <div
                                                    className="absolute bottom-0 h-1 bg-black bg-opacity-20"
                                                    style={{
                                                        width: `${(result.size / Math.pow(2, 16)) * 100}%`
                                                    }}
                                                />
                                            </div>

                                            {/* Lignes de connexion */}
                                            {index < results.length - 1 && (
                                                <div
                                                    className="absolute bottom-0 left-1/2 w-px h-6 bg-gray-300"
                                                    style={{ transform: 'translateY(100%)' }}
                                                />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-sm">
                                        <div className="space-y-2 p-1">
                                            <div className="grid grid-cols-2 gap-x-4 text-sm">
                                                <span className="text-gray-500">Réseau:</span>
                                                <span className="font-mono">{result.network}</span>
                                                <span className="text-gray-500">Masque:</span>
                                                <span className="font-mono">{result.mask}</span>
                                                <span className="text-gray-500">Première IP:</span>
                                                <span className="font-mono">{result.firstIP}</span>
                                                <span className="text-gray-500">Dernière IP:</span>
                                                <span className="font-mono">{result.lastIP}</span>
                                                <span className="text-gray-500">Broadcast:</span>
                                                <span className="font-mono">{result.broadcast}</span>
                                                <span className="text-gray-500">Taille:</span>
                                                <span>{result.size} hôtes</span>
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

export default NetworkVisualizer;