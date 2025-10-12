// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: {
				id: any;
				email: string;
				name: string;
				userType: string;
				isPaid: boolean;
			};
			session?: {
				token: string;
				userId: any;
				createdAt: Date;
				expiresAt: Date;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
