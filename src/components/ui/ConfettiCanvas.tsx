import React, { useEffect, useRef } from 'react'

interface ConfettiCanvasProps {
    isActive?: boolean;
    className?: string;
}

const ConfettiCanvas: React.FC<ConfettiCanvasProps> = ({ isActive = true, className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!isActive) return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animationId: number
        const particles: any[] = []
        const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ffffff']

        const createParticle = () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 5 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        })

        const resize = () => {
            if (!canvas.parentElement) return
            canvas.width = canvas.parentElement.clientWidth || 300
            canvas.height = canvas.parentElement.clientHeight || 300
        }
        resize()
        window.addEventListener('resize', resize)

        for (let i = 0; i < 100; i++) {
            particles.push(createParticle())
        }

        const animate = () => {
            if (!canvas || !ctx) return

            ctx.clearRect(0, 0, canvas.width, canvas.height)

            particles.forEach((p, i) => {
                p.y += p.speedY
                p.x += p.speedX
                p.rotation += p.rotationSpeed

                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation * Math.PI / 180)
                ctx.fillStyle = p.color
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
                ctx.restore()

                if (p.y > canvas.height) {
                    particles[i] = createParticle()
                    particles[i].y = -20
                }
            })

            animationId = requestAnimationFrame(animate)
        }
        animate()

        return () => {
            cancelAnimationFrame(animationId)
            window.removeEventListener('resize', resize)
        }
    }, [isActive])

    if (!isActive) return null

    return (
        <canvas
            ref={canvasRef}
            className={`pointer-events-none z-10 ${className}`}
            style={{ width: '100%', height: '100%' }}
        />
    )
}

export default ConfettiCanvas
