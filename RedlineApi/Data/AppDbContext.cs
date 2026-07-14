using Microsoft.EntityFrameworkCore;
using Redline.Domain.Entities;

namespace Redline.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Representam as nossas tabelas no banco de dados
        public DbSet<Store> Stores { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Vehicle> Vehicles { get; set; }
        public DbSet<Lead> Leads { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Esta é a mágica para o Postgres entender a nossa coluna JSONB (CustomSpecs)
            // O EF Core 8+ mapeia a classe CustomSpecs diretamente para uma coluna JSON
            modelBuilder.Entity<Vehicle>().OwnsOne(v => v.CustomSpecs, cs =>
            {
                cs.ToJson();
            });

            // --- Store ---
            modelBuilder.Entity<Store>(e =>
            {
                e.HasIndex(s => s.Slug).IsUnique();
            });

            // --- Vehicle: tenancy + índices de leitura (RNF-02) ---
            modelBuilder.Entity<Vehicle>(e =>
            {
                e.HasOne(v => v.Store)
                    .WithMany(s => s.Vehicles)
                    .HasForeignKey(v => v.StoreId)
                    .OnDelete(DeleteBehavior.Restrict); // conservador: não deleta loja com anúncios

                e.HasIndex(v => v.StoreId);
                e.HasIndex(v => v.SellerId);
                e.HasIndex(v => v.Brand);
                e.HasIndex(v => v.Stage);
                e.HasIndex(v => v.Price);
            });

            // --- User: tenancy opcional ---
            modelBuilder.Entity<User>(e =>
            {
                e.HasOne(u => u.Store)
                    .WithMany(s => s.Users)
                    .HasForeignKey(u => u.StoreId)
                    .OnDelete(DeleteBehavior.SetNull);

                e.HasIndex(u => u.StoreId);
            });

            // --- Lead: tenancy + índice composto (RNF-02) ---
            modelBuilder.Entity<Lead>(e =>
            {
                e.HasOne(l => l.Store)
                    .WithMany(s => s.Leads)
                    .HasForeignKey(l => l.StoreId)
                    .OnDelete(DeleteBehavior.Restrict);

                e.HasIndex(l => new { l.StoreId, l.Status });
            });

            // Configurando os relacionamentos para evitar problemas ao deletar um usuário
            modelBuilder.Entity<Lead>()
                .HasOne(l => l.AssignedSeller)
                .WithMany(u => u.AssignedLeads)
                .HasForeignKey(l => l.AssignedSellerId)
                .OnDelete(DeleteBehavior.SetNull); // Se o vendedor for deletado, o Lead não é perdido
        }
    }
}
