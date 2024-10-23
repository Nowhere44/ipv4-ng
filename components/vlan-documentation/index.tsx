'use client'

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VLANOverview } from './overview';
import { VLANStandards } from './standards';

export const VLANDocumentation = () => {
    return (
        <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
                <TabsTrigger value="overview">{`Vue d'ensemble`}</TabsTrigger>
                <TabsTrigger value="standards">Standards VLAN</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
                <VLANOverview />
            </TabsContent>

            <TabsContent value="standards">
                <VLANStandards />
            </TabsContent>
        </Tabs>
    );
};