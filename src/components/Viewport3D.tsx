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

function ToolpathLines({ toolpath, predicted = false }: { toolpath: Toolpath; predicted?: boolean }) {
  const points = useMemo(
    () => toolpath.orderedPoints
      .filter((point) => point.segmentType === 'extrusion')
      .map((point) => [point.x, point.y, point.z - (predicted ? point.predictedSag : 0)] as [number, number, number]),
    [toolpath, predicted],
  )
  return (
    <Line
      points={points}
      color={predicted ? '#e8edf0' : SUPPORT_COLORS.bridge}
      lineWidth={predicted ? 1.05 : 0.75}
      transparent
      opacity={0.96}
    />
  )
}

function AnchorPoints({ toolpath, timeline = 1 }: { toolpath: Toolpath; timeline?: number }) {
  const positions = useMemo(() => {
    const extrusion = toolpath.orderedPoints.filter((point) => point.segmentType === 'extrusion')
    const limit = Math.floor(extrusion.length * timeline)
    const anchors = extrusion.slice(0, limit).filter((point) => point.materialPhase === 'anchor')
    return new Float32Array(anchors.flatMap((point) => [point.x, point.y, point.z]))
  }, [toolpath, timeline])
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#f4f6f6" size={1.35} sizeAttenuation transparent opacity={0.95} /></points>
}

function DepositedMaterial({ points }: { points: Toolpath['orderedPoints'] }) {
  const positions = useMemo(
    () => new Float32Array(points.flatMap((point) => [point.x, point.y, point.z - point.predictedSag])),
    [points],
  )
  if (points.length < 2) return null
  return <group>
    <Line points={points.map((point) => [point.x, point.y, point.z - point.predictedSag] as [number, number, number])} color="#cbd5d7" lineWidth={1.2} />
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#edf2f3" size={0.48} sizeAttenuation transparent opacity={0.78} /></points>
  </group>
}

function Simulation({ toolpath, timeline }: { toolpath: Toolpath; timeline: number }) {
  const extrusionPoints = useMemo(
    () => toolpath.orderedPoints.filter((point) => point.segmentType === 'extrusion'),
    [toolpath],
  )
  const visibleCount = Math.max(1, Math.floor(extrusionPoints.length * timeline))
  const activePoint = extrusionPoints[Math.min(visibleCount - 1, extrusionPoints.length - 1)]
  const hotTail = extrusionPoints.slice(Math.max(0, visibleCount - 90), visibleCount)
  const deposited = extrusionPoints.slice(0, visibleCount)

  return (
    <group>
      <AnchorPoints toolpath={toolpath} timeline={timeline} />
      <DepositedMaterial points={deposited} />
      {hotTail.length > 1 && <Line points={hotTail.map((point) => [point.x, point.y, point.z - point.predictedSag] as [number, number, number])} color="#ff9d4d" lineWidth={2.1} />}
      {activePoint && (
        <group position={[activePoint.x, activePoint.y, activePoint.z + 7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[2.3, 8, 20]} />
            <meshStandardMaterial color="#e8eeef" metalness={0.75} roughness={0.25} />
          </mesh>
          <pointLight color="#ffad57" intensity={1.4} distance={28} />
        </group>
      )}
      {activePoint && <mesh position={[activePoint.x, activePoint.y, activePoint.z - activePoint.predictedSag]}>
        <sphereGeometry args={[1.15, 16, 12]} /><meshStandardMaterial color="#ff9d4d" emissive="#ff6a22" emissiveIntensity={1.2} />
      </mesh>}
    </group>
  )
}

function Scene({ surface, mappedCurves, toolpath, viewMode, timeline, bedSize }: Viewport3DProps) {
  const cameraDistance = Math.max(120, surface.maxRadius * 4.35, surface.height * 1.65)
  const surfaceOpacity = viewMode === 'design' ? 0.24 : 0.045

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
      {viewMode === 'design' && <PatternLines curves={mappedCurves} />}
      {viewMode === 'path' && <><ToolpathLines toolpath={toolpath} /><ToolpathLines toolpath={toolpath} predicted /><AnchorPoints toolpath={toolpath} /></>}
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
