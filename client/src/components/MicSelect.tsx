import { Select, type SelectOption } from '../ui'

interface Props {
  mics: MediaDeviceInfo[]
  currentId: string | null
  onSelect: (deviceId: string) => void
}

export function MicSelect({ mics, currentId, onSelect }: Props) {
  if (mics.length <= 1) return null
  const options: SelectOption[] = mics.map((m, i) => ({
    value: m.deviceId,
    label: m.label || `Microfone ${i + 1}`,
  }))
  return <Select icon="🎚️" value={currentId ?? ''} options={options} onChange={onSelect} ariaLabel="Microfone" />
}
