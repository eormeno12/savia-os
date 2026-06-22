import { Box } from "@chakra-ui/react";
import { OtpForm } from "@/components/auth/OtpForm";

export const metadata = { title: "Acceder — Savia" };

export default function LoginPage() {
  return (
    <Box
      as="main"
      minH="100svh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="bg"
      px="4"
    >
      <OtpForm />
    </Box>
  );
}
