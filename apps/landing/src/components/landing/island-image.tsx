import Image from "next/image";

type IslandImageProps = {
  /**
   * Fixed pixel size. Omit for responsive mode — the image fills its parent.
   * Parent must have explicit dimensions when size is omitted.
   */
  size?: number;
};

export function IslandImage({ size }: IslandImageProps) {
  if (size !== undefined) {
    return (
      <div
        style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
        aria-label="Isla de memoria SAVIA"
      >
        <Image
          src="/hero/savia-island.png"
          alt=""
          fill
          sizes={`${size}px`}
          style={{ objectFit: "contain" }}
          priority
          draggable={false}
        />
      </div>
    );
  }

  // Responsive: matches native 1356×803 aspect ratio (59.22%)
  return (
    <div
      style={{ position: "relative", width: "100%", paddingBottom: "59.22%" }}
      aria-label="Isla de memoria SAVIA"
    >
      <Image
        src="/hero/savia-island.png"
        alt=""
        fill
        sizes="(max-width: 767px) 100vw, 88vw"
        style={{ objectFit: "contain" }}
        priority
        draggable={false}
      />
    </div>
  );
}
