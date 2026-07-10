using Microsoft.EntityFrameworkCore;
using Redline.Domain.Entities;

namespace Redline.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Representam as nossas tabelas no banco de dados
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

            // Configurando os relacionamentos para evitar problemas ao deletar um usuário
            modelBuilder.Entity<Lead>()
                .HasOne(l => l.AssignedSeller)
                .WithMany(u => u.AssignedLeads)
                .HasForeignKey(l => l.AssignedSellerId)
                .OnDelete(DeleteBehavior.SetNull); // Se o vendedor for deletado, o Lead não é perdido
        }
    }
}