import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form , required, email, minLength, submit, FormField } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { RegisterData } from '../../../core/auth/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormField],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  errorMsg = signal<string | null>(null);
  loading = signal(false);

  registerModel = signal<RegisterData>({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    tipoSangre: '',
    colorOjos: '',
    diasVacaciones: 0,
  });

  registerForm = form(this.registerModel, (schemaPath) => {
    required(schemaPath.email, { message: 'El email es obligatorio' });
    email(schemaPath.email, { message: 'El email no es válido' });
    required(schemaPath.password, { message: 'La contraseña es obligatoria' });
    minLength(schemaPath.password, 6, { message: 'Mínimo 6 caracteres' });
    required(schemaPath.nombre, { message: 'El nombre es obligatorio' });
    required(schemaPath.apellido, { message: 'El apellido es obligatorio' });
    required(schemaPath.fechaNacimiento, { message: 'La fecha de nacimiento es obligatoria' });
  });

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set(null);

    await submit(this.registerForm, async (form) => {
      this.loading.set(true);
      const { error } = await this.authService.register(form().value());
      this.loading.set(false);

      if (error) {
        this.errorMsg.set(error);
        return;
      }
      this.router.navigate(['/']);
    });
  }
}