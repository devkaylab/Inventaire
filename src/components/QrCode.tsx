import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import QRCode from 'qrcode'
import { Radius } from '@/constants/ink'

/**
 * QR code dessiné dans l'app.
 *
 * Supabase rend son QR d'enrôlement sous forme d'image SVG en `data:` —
 * inaffichable par `<Image>` de React Native. On redessine donc les modules
 * nous-mêmes, avec la bibliothèque `qrcode` déjà utilisée par la planche de
 * balises.
 *
 * Fond blanc et modules noirs en dur, dans les deux thèmes : un QR sur fond
 * sombre ne se lit pas, les lecteurs attendent des modules foncés sur clair.
 */
export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const d = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const data = qr.modules.data
    const module = size / n
    let path = ''
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!data[y * n + x]) continue
        const px = x * module
        const py = y * module
        // Un chouïa de recouvrement : sans lui, l'antialiasing laisse des
        // filets clairs entre les modules et le code devient illisible.
        path += `M${px} ${py}h${module + 0.4}v${module + 0.4}h${-(module + 0.4)}z`
      }
    }
    return path
  }, [value, size])

  return (
    <View style={[styles.frame, { width: size + 16 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        <Path d={d} fill="#000000" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: Radius.md,
    alignSelf: 'center',
  },
})
