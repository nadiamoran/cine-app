import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PERMISOS, Permiso } from '../secciones-admin';
import { Rol, RolesService } from './roles.service';

@Component({
  selector: 'app-gestionar-roles',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gestionar-roles.component.html',
})
export class GestionarRolesComponent implements OnInit {
  readonly permisosDisponibles = PERMISOS;

  cargando = signal(true);
  roles = signal<Rol[]>([]);
  // null = creando un rol nuevo; con id = editando ese rol
  editandoId = signal<string | null>(null);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);

  // un checkbox por cada permiso: { peliculas: false, funciones: false, ... }
  rolForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    permisos: new FormGroup(
      Object.fromEntries(
        PERMISOS.map((permiso) => [permiso.clave, new FormControl(false, { nonNullable: true })]),
      ) as Record<Permiso, FormControl<boolean>>,
    ),
  });

  constructor(private rolesService: RolesService) {}

  async ngOnInit() {
    await this.recargar();
  }

  private async recargar() {
    this.cargando.set(true);
    this.roles.set(await this.rolesService.getRoles());
    this.cargando.set(false);
  }

  textoPermisos(rol: Rol): string {
    if (rol.permisos.length === 0) return 'Sin permisos';
    return PERMISOS.filter((permiso) => rol.permisos.includes(permiso.clave))
      .map((permiso) => permiso.texto)
      .join(', ');
  }

  async onGuardar() {
    this.errorMsg.set(null);
    if (this.rolForm.invalid) {
      this.rolForm.markAllAsTouched();
      return;
    }

    const valores = this.rolForm.getRawValue();
    const permisos = PERMISOS.filter((permiso) => valores.permisos[permiso.clave]).map((permiso) => permiso.clave);
    if (permisos.length === 0) {
      this.errorMsg.set('Elegí al menos un permiso');
      return;
    }

    this.guardando.set(true);
    const id = this.editandoId();
    const datos = { nombre: valores.nombre, permisos };
    const { error } = id
      ? await this.rolesService.actualizar(id, datos)
      : await this.rolesService.crear(datos);
    this.guardando.set(false);

    if (error) {
      this.errorMsg.set(error);
      return;
    }

    this.onCancelar();
    await this.recargar();
  }

  onEditar(rol: Rol) {
    this.rolForm.reset();
    this.rolForm.patchValue({
      nombre: rol.nombre,
      permisos: Object.fromEntries(rol.permisos.map((clave) => [clave, true])),
    });
    this.editandoId.set(rol.id);
    this.errorMsg.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelar() {
    this.rolForm.reset();
    this.editandoId.set(null);
    this.errorMsg.set(null);
  }

  async onEliminar(rol: Rol) {
    if (!confirm(`¿Eliminar el rol "${rol.nombre}"? Los usuarios que lo tienen se quedan sin permisos del panel.`)) {
      return;
    }

    const { error } = await this.rolesService.eliminar(rol.id);
    if (error) {
      this.errorMsg.set(error);
      return;
    }

    if (this.editandoId() === rol.id) this.onCancelar();
    await this.recargar();
  }
}
