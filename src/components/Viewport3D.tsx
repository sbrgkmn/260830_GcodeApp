import { Line, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { buildSurfaceMesh } from '../geometry/surfaces'
import type { MappedCurve, ParametricSurface, Toolpath, ViewMode } from '../types/domain'

interface Viewport3DProps {
  surface: ParametricSurface
  mappedCurves: MappedCurve[]
  toolpath: Toolpath
  viewMode: ViewMode
  timeline: number
  bedSize: [number, number, number]
}

const SUPPORT_COLORS = {
  supported: '#7de0bd',
  partial: '#f0c36a',
  bridge: '#f28d5f',
  air: '#d786ff',
  unprintable: '#ff5b66',
}

function ParametricMesh({ surface, opacity }: { surface: ParametricSurface; opacity: number }) {
  const geometry = useMemo(() => {
    const data = buildSurfaceMesh(surface, surface.resolution)
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    next.setIndex(new THREE.BufferAttribute(data.indices, 1))
    next.computeVertexNormals()
    return next
  }, [surface])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#7f878b"
        roughness={0.7}
        metalness={0.05}
        transparent={opacity < 1}
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={opacity > 0.45}
      />
    </mesh>
  )
}

function PatternLines({ curves }: { curves: MappedCurve[] }) {
  return (
    <group>
      {curves.map((curve) => (
        <Line
          key={curve.id}
          points={curve.points.map((point) => [point.x, point.y, point.z] as [number, number, number])}
          color={curve.family.includes('descending') || curve.family.includes('counter') ? '#7bd4e6' : '#d9f5f7'}
          lineWidth={1.15}
          transparent
          opacity={0.92}
        />
      ))}
    </group>
  )
}

function ToolpathLines({ toolpath, analysis, extrusion }: { toolpath: Toolpath; analysis?: boolean; extrusion?: boolean }) {
  return (
    <group>
      {toolpath.segments.map((segment) => (
        <Line
          key={segment.id}
          points={segment.points.map((point) => [point.x, point.y, point.z] as [number, number, number])}
          color={analysis ? SUPPORT_COLORS[segment.supportState] : extrusion ? '#f7a64b' : '#ffca72'}
          lineWidth={extrusion ? 3.2 : 1.8}
          transparent
          opacity={0.96}
        />
      ))}
    </group>
  )
}

function Simulation({ toolpath, timeline }: { toolpath: Toolpath; timeline: number }) {
  const extrusionPoints = useMemo(
    () => toolpath.orderedPoints.filter((point) => point.segmentType === 'extrusion'),
    [toolpath],
  )
  const visibleCount = Math.max(1, Math.floor(extrusionPoints.length * timeline))
  const activePoint = extrusionPoints[Math.min(visibleCount - 1, extrusionPoints.length - 1)]
  let traversed = 0

  return (
    <group>
      {toolpath.segments.map((segment) => {
        const localCount = Math.max(0, Math.min(segment.points.length, visibleCount - traversed))
        traversed += segment.points.length
        if (localCount < 2) return null
        return (
          <Line
            key={segment.id}
            points={segment.points.slice(0, localCount).map((point) => [point.x, point.y, point.z] as [number, number, number])}
            color="#f5b35f"
            lineWidth={2.7}
          />
        )
      })}
      {activePoint && (
        <group position={[activePoint.x, activePoint.y, activePoint.z + 7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[2.3, 8, 20]} />
            <meshStandardMaterial color="#e8eeef" metalness={0.75} roughness={0.25} />
          </mesh>
          <pointLight color="#ffad57" intensity={1.4} distance={28} />
        </group>
      )}
    </group>
  )
}

function Scene({ surface, mappedCurves, toolpath, viewMode, timeline, bedSize }: Viewport3DProps) {
  const cameraDistance = Math.max(260, surface.maxRadius * 4.35, surface.height * 1.65)
  const surfaceOpacity = viewMode === 'form' ? 0.95 : viewMode === 'pattern' ? 0.32 : 0.11

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance, -cameraDistance, surface.height * 0.74]}
        up={[0, 0, 1]}
        fov={34}
        near={0.1}
        far={2400}
      />
      <color attach="background" args={['#0d0f10']} />
      <fog attach="fog" args={['#0d0f10', 420, 900]} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[160, -100, 260]} intensity={2.1} castShadow />
      <directionalLight position={[-120, 100, 90]} intensity={0.55} color="#8fddeb" />

      <gridHelper
        args={[Math.max(bedSize[0], bedSize[1]), 22, '#344145', '#1e2528']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.25]}
      />
      <lineSegments position={[0, 0, 0.05]}>
        <edgesGeometry args={[new THREE.BoxGeometry(bedSize[0], bedSize[1], 0.1)]} />
        <lineBasicMaterial color="#3e5156" transparent opacity={0.65} />
      </lineSegments>

      <ParametricMesh surface={surface} opacity={surfaceOpacity} />
      {viewMode === 'pattern' && <PatternLines curves={mappedCurves} />}
      {viewMode === 'toolpath' && <ToolpathLines toolpath={toolpath} />}
      {viewMode === 'extrusion' && <ToolpathLines toolpath={toolpath} extrusion />}
      {viewMode === 'analysis' && <ToolpathLines toolpath={toolpath} analysis />}
      {viewMode === 'simulation' && <Simulation toolpath={toolpath} timeline={timeline} />}

      <OrbitControls
        target={[0, 0, surface.height / 2]}
        enableDamping
        dampingFactor={0.08}
        minDistance={70}
        maxDistance={850}
        makeDefault
      />
    </>
  )
}

export function Viewport3D(props: Viewport3DProps) {
  return (
    <div className="viewport-canvas" aria-label="Interactive parametric 3D viewport">
      <Canvas dpr={[1, 1.7]} gl={{ antialias: true, preserveDrawingBuffer: true }} shadows>
        <Scene {...props} />
      </Canvas>
      <div className="viewport-axis" aria-hidden="true">
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
        <i />
      </div>
      <div className="viewport-hint">Orbit · Pan · Zoom</div>
    </div>
  )
}
