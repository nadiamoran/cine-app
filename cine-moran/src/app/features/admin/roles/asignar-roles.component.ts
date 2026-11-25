import { Component, OnInit, computed, signal } from '@angular/core';
import { Rol, RolesService, UsuarioListado } from './roles.service';

@Component({
  selector: 'app-asignar-roles',
  standalone: true,
  templateUrl: './asignar-roles.component.html',
})
export class AsignarRolesComponent implements OnInit {
  cargando = signal(true);
  usuarios = signal<UsuarioListado[]>([]);
  roles = signal<Rol[]>([]);
  busqueda = signal('');
  guardandoId = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  exito = signal<string | null>(null);

  // se recalcula solo cuando cambian los usuarios o la búsqueda
  usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.usuarios().filter(
      (u) =>
        !texto ||
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(texto) ||
        u.email.toLowerCase().includes(texto),
    );
  });

  constructor(private rolesService: RolesService) {}

  async ngOnInit() {
    const [usuarios, roles] = await Promise.all([
      this.rolesService.getUsuarios(),
      this.rolesService.getRoles(),
    ]);
    this.usuarios.set(usuarios);
    this.roles.set(roles);
    this.cargando.set(false);
  }

  async onCambiarRol(usuario: UsuarioListado, rolId: string) {
    this.errorMsg.set(null);
    this.exito.set(null);
    this.guardandoId.set(usuario.id);

    const nuevoRolId = rolId || null;
    const { error } = await this.rolesService.asignarRol(usuario.id, nuevoRolId);
    this.guardandoId.set(null);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.usuarios.update((lista) =>
      lista.map((u) => (u.id === usuario.id ? { ...u, rolId: nuevoRolId } : u)),
    );
    this.exito.set(`Rol actualizado para ${usuario.nombre} ${usuario.apellido}.`);
  }
}
