'use client'

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function PlannerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()

    return (
        <div className="min-h-screen p-4 md:p-8 bg-gray-50">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Button
                        onClick={() => router.back()}
                        variant="outline"
                        size="sm"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour
                    </Button>
                    <h1 className="text-4xl font-bold text-gray-900">Planification Réseau</h1>
                </div>
                {children}
            </div>
        </div>
    )
}