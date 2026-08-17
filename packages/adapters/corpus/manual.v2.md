---
titulo: Manual de proveedores
version: 4
vigencia: 2026-08-16
archivado: no
---

# Manual de proveedores

Este manual describe **el circuito completo** de alta, con su `checklist` y el
[procedimiento oficial](https://savia.uno/alta).

> Un proveedor sin CUIT verificado no se da de alta.

## Alta de un proveedor nuevo

Este circuito aplica a proveedores nacionales y del exterior.

Los pasos son estos:

1. Pedir la documentación
2. Verificar el CUIT
   - Contra el padrón
   - Contra la factura
3. Cargar el legajo

```SQL
select razon_social from proveedor where verificado = false;
```

![Diagrama del circuito](https://savia.uno/circuito.png "Circuito de alta, versión 3")

![Legajo tipo](https://savia.uno/legajo.png)

*El legajo cerrado, con sus cuatro adjuntos.*

![Sello de aprobación](https://savia.uno/sello.png)

| Etapa | Responsable |
| --- | --- |
| Alta | Compras |
| Verificación | Legales |

---

## Anexo

El sello se aplica en Legales y no forma parte del legajo firmado.
