using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RedlineApi.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleIsActive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Coluna com default true: veículos existentes (seed) permanecem ativos (§5/tarefa 2).
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Vehicles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // Índice composto para vitrine (StoreId + IsActive) e aba Estoque.
            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_StoreId_IsActive",
                table: "Vehicles",
                columns: new[] { "StoreId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Vehicles_StoreId_IsActive",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Vehicles");
        }
    }
}
