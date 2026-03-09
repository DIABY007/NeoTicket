import Image from "next/image";

type NeoTicketLogoProps = {
  size?: number;
  className?: string;
};

export function NeoTicketLogo({ size = 32, className }: NeoTicketLogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="NeoTicket"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
