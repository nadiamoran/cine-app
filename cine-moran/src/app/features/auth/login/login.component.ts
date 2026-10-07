import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  errorMsg = signal<string | null>(null);
  loading = signal(false);

  // validaciones del front: forma y estructura de los datos en el navegador.
  // nonNullable evita que reset() deje los controles en null.
  loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  // valida contra Supabase y carga el perfil real del usuario
  async onSubmit() {
    this.errorMsg.set(null);

    if (this.loginForm.invalid) {
      // marcamos todo como "tocado" para que se muestren los mensajes de error
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { error } = await this.authService.login(this.loginForm.getRawValue());
    this.loading.set(false);

    if (error) {
      // mapeamos el error en inglés de Supabase a un mensaje en español
      if (error.includes('Invalid login credentials')) {
        this.errorMsg.set('El correo o la contraseña son incorrectos. Intente nuevamente.');
      } else {
        // mensaje de respaldo por si ocurre otro error (ej: sin internet)
        this.errorMsg.set('Ocurrió un error al intentar iniciar sesión.');
      }
      return;
    }

    // el empleado solo valida entradas: arranca directo en esa pantalla
    const rol = this.authService.currentUser()?.rol;
    this.router.navigate([rol === 'empleado' ? '/empleado/validar' : '/']);
  }
}
