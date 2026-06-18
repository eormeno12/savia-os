import { COMMUNITY_AVATARS } from '@/lib/constants';

type AvatarStackProps = {
  size?: number;
  borderColor?: string;
  borderWidth?: string;
};

export function AvatarStack({
  size = 24,
  borderColor = '#ECEDEA',
  borderWidth = '1.5px',
}: AvatarStackProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center' }}
      aria-label={`${COMMUNITY_AVATARS.length} miembros de la comunidad`}
    >
      {COMMUNITY_AVATARS.map((avatar, i) => (
        <div
          key={avatar.label}
          aria-hidden="true"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `${borderWidth} solid ${borderColor}`,
            backgroundColor: avatar.bg,
            color: avatar.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: i > 0 ? -7 : 0,
            position: 'relative',
            zIndex: 4 - i,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 6.5,
              fontWeight: 800,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {avatar.label}
          </span>
        </div>
      ))}
    </div>
  );
}
